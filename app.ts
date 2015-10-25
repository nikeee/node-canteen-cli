///<reference path="typings/tsd.d.ts"/>
///<reference path="./Interfaces.ts"/>

import * as yargs from "yargs";
import Menu from "./Menu";
import * as Promise from "bluebird";

const commands = ["pull", "list"];
const [pullCommand, listCommand] = commands;

let args = yargs
.command(pullCommand, "Pull current menu of a canteen and put result to stdout.", args => {
	let argv = <PullArgs>args
		.string("canteen").alias("c", "canteen").require("canteen", "The canteen to fetch")
		.argv;
	requestMenu(argv.canteen)
	.then(printMenu)
	.catch(errorAndExit)
	.done();
})
.command(listCommand, "List available canteens", args => list())
.argv;

let usedCommand = args._[0].toLowerCase();
if(commands.indexOf(usedCommand) < 0)
{
	yargs.showHelp();
	process.exit(1);
}

function errorAndExit(err: Error): void
{
	console.error("Error: %s", err.message);
	process.exit(1);
}

function printMenu(res: IParseResult): void
{
	if(res.success && typeof res.menu !== "undefined")
		return console.log(jsonify(res.menu));
	return console.error(res.message);
}

function jsonify(obj: Object): string
{
	return JSON.stringify(obj, null, "\t");
}

function requestMenu(canteen: string): Promise<IParseResult>
{
	if(!canteen || !Menu.isCanteenAvailable(canteen))
		return Promise.reject(new Error("Canteen not available."));
	return Menu.pull(canteen);
}

function list()
{
	for(let c in Menu.availableCanteens)
		console.log(c);
}
