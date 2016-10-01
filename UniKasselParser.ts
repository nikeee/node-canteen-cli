///<reference path="typings/tsd.d.ts"/>
///<reference path="./Interfaces.ts"/>

import * as cheerio from "cheerio";
import * as moment from "moment";
import Parsers from "./ParseUtilities";

export default class UniKasselParser implements IMenuParser
{
	public parse(canteen: ICanteenItem, response: string): IParseResult
	{
		let $ = cheerio.load(response);
		let $tbody = $("div.mainmensa table");

		// "Speiseplan vom 08.09. bis 12.09.2014"
		let intervalStr = $("tr.thead h4", $tbody).text();
		let validity = this.parseValidityInterval(intervalStr);

		let meals = this.parseMeals($, $tbody, canteen);

		return {
			success: true,
			menu: {
				info: canteen.info,
				validity: {
					from: Parsers.fixDateOffset(validity.from),
					until: Parsers.fixDateOffset(validity.until)
				},
				currency: "€",
				meals: meals,
			}
		};
	}

	private parseMeals($: CheerioStatic, $tbody: Cheerio, canteen: ICanteenItem): IMeals
	{
		let numMeals = canteen.mealCount || 1;

		const offset = 4;

		let meals: IMeals = {};

		let $prices = $("tr.price_row", $tbody);
		let $items = $("tr.items_row", $tbody);

		for(let row = 0; row < numMeals; ++row)
		{
			let trChildId = offset + row * 2;
			let $currentRow = $items[row];
			let $rowBeneath = $prices[row];

			// "Essen 1", "Essen 2", "Essen 3 oder 4", "Angebot des Tages"
			let genericMealName = $("td.menu_head", $currentRow).text();

			// "Essen X" for Monday, Tuesday, Wednesday etc.
			let mealIdDuringDays: { [dayOfWeek: number]: IMealItem } = {};

			let $tds = $("td", $currentRow);
			let $tdsBeneath = $("td", $rowBeneath);

			for(let dayOfWeek = 1; dayOfWeek <= 5; ++dayOfWeek)
			{
				let tdChildId = dayOfWeek + 1;
				// TODO: Better indexing
				let $td = $("td.menu_content:nth-child(" + tdChildId + ")", $currentRow);
				let $tdBeneath = $("td.menu_content:nth-child(" + tdChildId + ")", $rowBeneath);

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				let currentMealName = $td.text();

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				let realMealName = UniKasselParser.sanitizeMealName(currentMealName);

				// (1, 3, 9a) (V), Kcal:718, E:28.0 g, K:98.0 g, Fe:22.0 g
				let zsnamen = $(".zsnamen", $td).text()
				// [1, 3, 9a, 30, 35, V]
				let attr = UniKasselParser.getMealAttributes(zsnamen);

				let price = UniKasselParser.parseMealPrice($tdBeneath.text());

				let isVital = $td.hasClass("mensavital");
				let vitalInfo = isVital ? UniKasselParser.parseMensaVital(zsnamen) : null;

				if(!realMealName && !price)
				{
					mealIdDuringDays[dayOfWeek] = null;
				}
				else
				{
					mealIdDuringDays[dayOfWeek] = {
						name: realMealName,
						attributes: attr || [],
						price: price,
						vitalInfo: vitalInfo
					};
				}
			}
			meals[genericMealName] = mealIdDuringDays;
		}
		return meals;
	}

	private static parseMensaVital(zsnamen: string): IMensaVitalItem
	{
		//Kcal:718, E:28.0 g, K:98.0 g, Fe:22.0 g
		let calories = /Kcal:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		let protein = /E:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		let carbohydrate = /K:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		let fat = /Fe:\s*([-+]?[0-9]*\.?[0-9]+)/im;

		let fatr = fat.exec(zsnamen);
		let carbohydrater = carbohydrate.exec(zsnamen);
		let proteinr = protein.exec(zsnamen);
		let caloriesr = calories.exec(zsnamen);

		return {
			fat: fatr != null ? parseFloat(fatr[1]) : 0.0,
			carbohydrate: carbohydrater != null ? parseFloat(carbohydrater[1]) : 0.0,
			protein: proteinr != null ? parseFloat(proteinr[1]) : 0.0,
			calories: caloriesr != null ? parseFloat(caloriesr[1]) : 0.0
		};
	}

	private static parseMealPrice(text: string): IPriceItem
	{
		if(!text || !text.trim())
			return null;

		text = text.replace(/€/gim, "")
					.replace(/,/gim, ".")
					.replace(/\s/gim, "")
					.replace(/\(.*?\)/gim, "");

		let tsplit = text.split("/");
		if(tsplit.length != 3)
		{
			console.error("Whoopsie. Invalid price?");
			console.error(text);
			return null;
		}

		return {
			student: parseFloat(tsplit[0]),
			employee: parseFloat(tsplit[1]),
			visitor: parseFloat(tsplit[2])
		}
	}

	private static sanitizeMealName(name: string): string
	{
		if(!name)
			return "";
		name = name
				.replace(UniKasselParser._mealAttrRe, "")
				.replace(/\s{2,}/gim, " ")
				.replace(/\s,/gim, ",");
		if(name.lastIndexOf("Kcal") > -1)
			name = name.substring(0, name.lastIndexOf("Kcal"));
		return name.trim();
	}

	private static _mealAttrRe = /\((.*?)\)/gim;
	private static getMealAttributes(name: string): string[]
	{
		if(!name)
			return [];
		name = name.replace(/\s/gim, "");
		let m;
		let s = "";
		while((m = UniKasselParser._mealAttrRe.exec(name)) !== null)
		{
			if(!!m || m.length > 0)
				s += m[1] + ",";
		}
		s = s.substring(0, s.length - 1).toUpperCase();
		s = s
			.replace(/\(/gim, ",")
			.replace(/\)/gim, ",")
			.replace(/,{2,}/gim, ",");
		return s.split(",").filter(attr => attr && attr.trim() !== "").concat();
	}

	private parseValidityInterval(intervalStr: string): IMenuValidity
	{

		// "Speiseplan vom 08.09. bis 12.09.2014"
		let intervalReExec = /(\d+\.\d+\.\d*)\s*.*\s+(\d+\.\d+\.\d+)/gim.exec(intervalStr);

		// If parsing the date values failed, just use the current week as interval
		if(!intervalReExec || intervalReExec.length != 3)
		{
			return {
				from : moment().startOf("week").toDate(),
				until: moment().endOf("week").toDate()
			};
		}

		//08.09. -> 08.09.2014
		let fromSplit = intervalReExec[1].split(".");
		let untilSplit = intervalReExec[2].split(".");
		untilSplit[2] = untilSplit[2] || (new Date()).getFullYear().toString();
		fromSplit[2] = fromSplit[2] || untilSplit[2];

		let fromDate = moment(fromSplit.join("."), "DD.MM.YYYY").toDate();
		let untilDate = moment(untilSplit.join("."), "DD.MM.YYYY").toDate();

		return {
			from : fromDate,
			until: untilDate
		};
	}
}
