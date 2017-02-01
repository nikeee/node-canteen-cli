import * as fs from "fs";
import * as request from "request";
import UniKasselParser from "./UniKasselParser";
import LegacyUniKasselParser from "./LegacyUniKasselParser";

export default class Menu
{
	public static availableCanteens: ICanteenList = {
		wilhelmshoehe: {
			info: {
				name: "Mensa Wilhelmshöher Allee",
				location: {
					lat: 51.31116,
					long: 9.47467
				}
			},
			url: "http://www.studentenwerk-kassel.de/189.html",
			parser: new UniKasselParser(),
			mealCount: 5
		},
		hopla: {
			info: {
				name: "Zentralmensa Uni Kassel",
				locationDescription: "Holländischer Platz",
				location: {
					lat: 51.32318,
					long: 9.50626
				}
			},
			url: "http://www.studentenwerk-kassel.de/188.html",
			parser: new UniKasselParser(),
			mealCount: 6
		},
		menzelstrasse: {
			info: {
				name: "Mensa Menzelstraße",
				location: {
					lat: 51.305234,
					long: 9.489587
				}
			},
			url: "http://www.studentenwerk-kassel.de/195.html",
			parser: new UniKasselParser(),
			mealCount: 2 /* actually there are more, but they don't get used */
		},
		plett: {
			info: {
				name: "Mensa Heinrich-Plett-Straße",
				location: {
					lat: 51.282003,
					long: 9.447503
				}
			},
			url: "http://www.studentenwerk-kassel.de/187.html",
			parser: new UniKasselParser(),
			mealCount: 4
		},
		witzenhausen: {
			info: {
				name: "Mensa Witzenhausen",
				location: {
					lat: 51.343777,
					long: 9.859827
				}
			},
			url: "http://www.studentenwerk-kassel.de/415.html",
			parser: new UniKasselParser(),
			mealCount: 4
		},
		k10: {
			info: {
				name: "Bistro K10",
				location: {
					lat: 51.321952,
					long: 9.503411
				}
			},
			url: "https://www.studentenwerk-kassel.de/de/meta/speiseplan/bistrok10/",
			parser: new UniKasselParser(),
			mealCount: 3
		}
	};

	public static isCanteenAvailable(canteen: string): boolean
	{
		return typeof Menu.availableCanteens[canteen.toLowerCase()] !== "undefined";
	}

	public static pull(canteen: string): Promise<IParseResult>
	{
		if(!canteen || typeof Menu.availableCanteens[canteen.toLowerCase()] === "undefined")
			return Promise.reject(new Error("Canteen not available"))

		let canteenData = Menu.availableCanteens[canteen];

		if(!fs.existsSync(canteenData.url))
		{
			return new Promise((resolve, reject) => {
				request(canteenData.url, (error: any, response: any, body: string) => {
					if (error) return reject(error);
					const m = Menu.handleBody(canteenData, body);
					return resolve(m);
				});
			});
		}
		return new Promise((resolve, reject) => {
			fs.readFile(canteenData.url, (err, body) => {
				if (err) return reject(err);
				return resolve(Menu.handleBody(canteenData, body.toString()));
			});
		});
	}

	private static handleBody(canteenData: ICanteenItem, body: string): IParseResult
	{
		return canteenData.parser.parse(canteenData, body);
	}
}
