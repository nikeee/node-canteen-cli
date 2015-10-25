///<reference path="typings/tsd.d.ts"/>
///<reference path="./Interfaces.ts"/>

import * as cheerio from "cheerio";
import * as moment from "moment";
import Parsers from "./ParseUtilities";

export default class LegacyUniKasselParser implements IMenuParser
{
	public parse(canteen: ICanteenItem, response: string): IParseResult
	{
		var $ = cheerio.load(response);
		var $tbody = $("body#essen table tbody");

		// "Speiseplan vom 08.09. bis 12.09.2014"
		var intervalStr = $("tr[valign=bottom] td strong", $tbody).text();
		var validity = this.parseValidityInterval(intervalStr);

		var meals = this.parseMeals($, $tbody, canteen);

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
		var numMeals = canteen.mealCount || 1;

		var offset = 4;

		var meals: IMeals = {};

		for(var row = 0; row < numMeals; ++row)
		{
			var trChildId = offset + row * 2;
			var $currentRow = $("tr:nth-child(" + trChildId + ")", $tbody);
			var $rowBeneath = $("tr:nth-child(" + (trChildId + 1) + ")", $tbody);

			// "Essen 1", "Essen 2", "Essen 3 oder 4", "Angebot des Tages"
			var genericMealName = $("td.gelb strong.big2", $currentRow).text();

			// "Essen X" for Monday, Tuesday, Wednesday etc.
			var mealIdDuringDays: { [dayOfWeek: number]: IMealItem } = {};

			var $tds = $("td", $currentRow);
			var $tdsBeneath = $("td", $rowBeneath);

			for(var dayOfWeek = 1; dayOfWeek <= 5; ++dayOfWeek)
			{
				var tdChildId = dayOfWeek + 1;
				var $td = $("td:nth-child(" + tdChildId + ")", $currentRow);
				var $tdBeneath = $("td:nth-child(" + tdChildId + ")", $rowBeneath);

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce (1,3,9a,30,35) (V)
				var currentMealName = $td.text();

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				var realMealName = LegacyUniKasselParser.sanitizeMealName(currentMealName);

				// [1, 3, 9a, 30, 35, V]
				var attr = LegacyUniKasselParser.getMealAttributes(currentMealName);

				var price = LegacyUniKasselParser.parseMealPrice($tdBeneath.text());

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
						vitalInfo: null
					};
				}
			}
			meals[genericMealName] = mealIdDuringDays;
		}
		return meals;
	}

	private static parseMealPrice(text: string): IPriceItem
	{
		if(!text || !text.trim())
			return null;

		text = text.replace(/€/gim, "")
					.replace(/,/gim, ".")
					.replace(/\s/gim, "")
					.replace(/\(.*?\)/gim, "");

		var tsplit = text.split("/");
		if(tsplit.length != 3)
		{
			console.debug("Whoopsie. Invalid price?");
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
				.replace(LegacyUniKasselParser._mealAttrRe, "")
				.replace(/\s{2,}/gim, " ")
				.replace(/\s,/gim,",");
		return name.trim();
	}

	private static _mealAttrRe = /\((.*?)\)/gim;
	private static getMealAttributes(name: string): string[]
	{
		if(!name)
			return [];
		name = name.replace(/\s/gim, "");
		var m;
		var s = "";
		while((m = LegacyUniKasselParser._mealAttrRe.exec(name)) !== null)
		{
			if(!!m || m.length > 0)
				s += m[1] + ",";
		}
		s = s.substring(0, s.length - 1);
		s = s
			.replace(/\(/gim, ",")
			.replace(/\)/gim, ",")
			.replace(/,{2,}/gim, ",");
		return s.split(",").concat();
	}

	private parseValidityInterval(intervalStr: string): IMenuValidity
	{

		// "Speiseplan vom 08.09. bis 12.09.2014"
		var intervalReExec = /(\d+\.\d+\.\d*)\s*.*\s+(\d+\.\d+\.\d+)/gim.exec(intervalStr);

		// If parsing the date values failed, just use the current week as interval
		if(!intervalReExec || intervalReExec.length != 3)
		{
			return {
				from : moment().startOf("week").toDate(),
				until: moment().endOf("week").toDate()
			};
		}

		//08.09. -> 08.09.2014
		var fromSplit = intervalReExec[1].split(".");
		var untilSplit = intervalReExec[2].split(".");
		untilSplit[2] = untilSplit[2] || (new Date()).getFullYear().toString();
		fromSplit[2] = fromSplit[2] || untilSplit[2];

		var fromDate = moment(fromSplit.join("."), "DD.MM.YYYY").toDate();
		var untilDate = moment(untilSplit.join("."), "DD.MM.YYYY").toDate();

		return {
			from : fromDate,
			until: untilDate
		};
	}
}
