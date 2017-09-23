import * as cheerio from "cheerio";
import * as moment from "moment";
import Parsers from "./ParseUtilities";

export default class LegacyUniKasselParser implements IMenuParser<ICanteenMenu>
{
	public parse(canteen: ICanteenItem, response: string): IParseResult<ICanteenMenu>
	{
		const $ = cheerio.load(response);
		const $tbody = $("body#essen table tbody");

		// "Speiseplan vom 08.09. bis 12.09.2014"
		const intervalStr = $("tr[valign=bottom] td strong", $tbody).text();
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

		for(let row = 0; row < numMeals; ++row)
		{
			const trChildId = offset + row * 2;
			const $currentRow = $("tr:nth-child(" + trChildId + ")", $tbody);
			const $rowBeneath = $("tr:nth-child(" + (trChildId + 1) + ")", $tbody);

			// "Essen 1", "Essen 2", "Essen 3 oder 4", "Angebot des Tages"
			const genericMealName = $("td.gelb strong.big2", $currentRow).text();

			// "Essen X" for Monday, Tuesday, Wednesday etc.
			const mealIdDuringDays: { [dayOfWeek: number]: IMealItem | null } = {};

			const $tds = $("td", $currentRow);
			const $tdsBeneath = $("td", $rowBeneath);

			for(let dayOfWeek = 1; dayOfWeek <= 5; ++dayOfWeek)
			{
				const tdChildId = dayOfWeek + 1;
				const $td = $("td:nth-child(" + tdChildId + ")", $currentRow);
				const $tdBeneath = $("td:nth-child(" + tdChildId + ")", $rowBeneath);

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce (1,3,9a,30,35) (V)
				const currentMealName = $td.text();

				// Geschwenkte Kartoffel-Paprika-Pfanne mit Wasabisauce
				const realMealName = LegacyUniKasselParser.sanitizeMealName(currentMealName);

				// [1, 3, 9a, 30, 35, V]
				const attr = LegacyUniKasselParser.getMealAttributes(currentMealName);

				const price = LegacyUniKasselParser.parseMealPrice($tdBeneath.text());

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
						vitalInfo: null
					};
				}
			}
			meals[genericMealName] = mealIdDuringDays;
		}
		return meals;
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
		console.assert(tsplit.length === 3, "Whoopsie. Invalid price?")

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
		let m;
		let s = "";
		while((m = LegacyUniKasselParser._mealAttrRe.exec(name)) !== null)
		{
			if(!!m && m.length > 0)
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
