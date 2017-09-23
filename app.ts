#!/usr/bin/env node

import * as yargs from "yargs";
import Menu from "./Menu";

const args = yargs
	.command("pull <canteen>", "Pull current menu of a canteen and put result to stdout.", {}, async (args: { canteen: string; transposed: boolean; }) => {
		try {
			const res = await requestMenu(args.canteen)
			printMenu(res, args.transposed);
		} catch (ex) { errorAndExit(ex); }
	})
	.command("list", "List available canteens", {}, _ => list())
	.option("transposed", {
		alias: "t",
		default: false,
		type: "boolean",
	})
	.global("transposed")
	.help().alias("h", "help")
	.wrap(yargs.terminalWidth())
	.argv;

function errorAndExit(err: Error): void {
	console.error("Error: %s", err.message);
	process.exit(1);
}

function printMenu(res: IParseResult<ICanteenMenu>, transposed: boolean): void {
	if (res.success && typeof res.menu !== "undefined") {
		if (transposed) {
			let res2 = transformResult(res);
			return console.log(jsonify(res2.menu));
		}
		return console.log(jsonify(res.menu));
	}
	return console.error(res.message);
}

function transformResult(parsed: IParseResult<ICanteenMenu>): IParseResult<ITransposedCanteenMenu> {
	const days: ITransposedMealItem[][] = [];
	const meals = parsed.menu.meals;

	for (const categoryName in meals) {
		if (meals.hasOwnProperty(categoryName)) {
			const element = meals[categoryName];
			for (const dayOfWeek in element) {
				if (element.hasOwnProperty(dayOfWeek)) {
					const doW = typeof dayOfWeek === "number" ? dayOfWeek : parseInt(dayOfWeek);
					const m = element[dayOfWeek];
					const index = doW - 1;
					// console.log(index);
					// console.dir(m);
					if (days[index] === undefined)
						days[index] = [];
					if (m !== null && m !== undefined) {
						days[index].push({
							...m,
							categoryName
						});
					}
				}
			}
		}
	}

	const menu: ITransposedCanteenMenu = {
		currency: parsed.menu.currency,
		info: parsed.menu.info,
		validity: parsed.menu.validity,
		days,
	};
	return {
		menu,
		message: parsed.message,
		success: parsed.success
	};
}

function jsonify(obj: Object): string {
	return JSON.stringify(obj, null, "\t");
}

function requestMenu(canteen: string): Promise<IParseResult<ICanteenMenu>> {
	if (!canteen || !Menu.isCanteenAvailable(canteen))
		return Promise.reject(new Error("Canteen not available."));
	return Menu.pull(canteen);
}

function list() {
	for (let c in Menu.availableCanteens)
		console.log(c);
}
