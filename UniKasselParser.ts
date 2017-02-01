import * as cheerio from "cheerio";
import * as moment from "moment";
import Parsers from "./ParseUtilities";

export default class UniKasselParser implements IMenuParser
{
	public parse(canteen: ICanteenItem, response: string): IParseResult
	{
		const $ = cheerio.load(response);
		const $tbody = $("div.mainmensa table");

		// "Speiseplan vom 08.09. bis 12.09.2014"
		const intervalStr = $("tr.thead h4", $tbody).text();
		const validity = this.parseValidityInterval(intervalStr);

		const meals = this.parseMeals($, $tbody, canteen);

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
		const numMeals = canteen.mealCount || 1;

		const offset = 4;

		const meals: IMeals = {};

		const $prices = $("tr.price_row", $tbody);
		const $items = $("tr.items_row", $tbody);

		for(let row = 0; row < numMeals; ++row)
		{
			const trChildId = offset + row * 2;
			const $currentRow = $items[row];
			const $rowBeneath = $prices[row];

			// "Essen 1", "Essen 2", "Essen 3 oder 4", "Angebot des Tages"
			const genericMealName = $("td.menu_head", $currentRow).text();

			// "Essen X" for Monday, Tuesday, Wednesday etc.
			const mealIdDuringDays: { [dayOfWeek: number]: IMealItem | null } = {};

			const $tds = $("td", $currentRow);
			const $tdsBeneath = $("td", $rowBeneath);

			for(let dayOfWeek = 1; dayOfWeek <= 5; ++dayOfWeek)
			{
				const tdChildId = dayOfWeek + 1;
				// TODO: Better indexing
				const $td = $("td.menu_content:nth-child(" + tdChildId + ")", $currentRow);
				const $tdBeneath = $("td.menu_content:nth-child(" + tdChildId + ")", $rowBeneath);

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				const currentMealName = $td.text();

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				const realMealName = UniKasselParser.sanitizeMealName(currentMealName);

				// (1, 3, 9a) (V), Kcal:718, E:28.0 g, K:98.0 g, Fe:22.0 g
				const zsnamen = $(".zsnamen", $td).text()
				// [1, 3, 9a, 30, 35, V]
				const attr = UniKasselParser.getMealAttributes(zsnamen);

				const price = UniKasselParser.parseMealPrice($tdBeneath.text());

				const isVital = $td.hasClass("mensavital");
				const vitalInfo = isVital ? UniKasselParser.parseMensaVital(zsnamen) : null;

				if(!realMealName || !price)
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
		const calories = /Kcal:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		const protein = /E:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		const carbohydrate = /K:\s*([-+]?[0-9]*\.?[0-9]+)/im;
		const fat = /Fe:\s*([-+]?[0-9]*\.?[0-9]+)/im;

		const fatr = fat.exec(zsnamen);
		const carbohydrater = carbohydrate.exec(zsnamen);
		const proteinr = protein.exec(zsnamen);
		const caloriesr = calories.exec(zsnamen);

		return {
			fat: fatr != null ? parseFloat(fatr[1]) : 0.0,
			carbohydrate: carbohydrater != null ? parseFloat(carbohydrater[1]) : 0.0,
			protein: proteinr != null ? parseFloat(proteinr[1]) : 0.0,
			calories: caloriesr != null ? parseFloat(caloriesr[1]) : 0.0
		};
	}

	private static parseMealPrice(text: string): IPriceItem | null
	{
		if(!text || !text.trim())
			return null;

		text = text.replace(/€/gim, "")
					.replace(/,/gim, ".")
					.replace(/\s/gim, "")
					.replace(/\(.*?\)/gim, "");

		const tsplit = text.split("/");
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

	private static readonly _mealAttrRe = /\((.*?)\)/gim;
	private static getMealAttributes(name: string): string[]
	{
		if(!name)
			return [];
		name = name.replace(/\s/gim, "");
		let m;
		let s = "";
		while((m = UniKasselParser._mealAttrRe.exec(name)) !== null)
		{
			if(!!m && m.length > 0)
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
		const intervalReExec = /(\d+\.\d+\.\d*)\s*.*\s+(\d+\.\d+\.\d+)/gim.exec(intervalStr);

		// If parsing the date values failed, just use the current week as interval
		if(!intervalReExec || intervalReExec.length != 3)
		{
			return {
				from : moment().startOf("week").toDate(),
				until: moment().endOf("week").toDate()
			};
		}

		//08.09. -> 08.09.2014
		const fromSplit = intervalReExec[1].split(".");
		const untilSplit = intervalReExec[2].split(".");
		untilSplit[2] = untilSplit[2] || (new Date()).getFullYear().toString();
		fromSplit[2] = fromSplit[2] || untilSplit[2];

		const fromDate = moment(fromSplit.join("."), "DD.MM.YYYY").toDate();
		const untilDate = moment(untilSplit.join("."), "DD.MM.YYYY").toDate();

		return {
			from : fromDate,
			until: untilDate
		};
	}
}
