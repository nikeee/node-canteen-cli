import * as yargs from "yargs";
import Menu from "./Menu";

const commands = ["pull", "list"];
const [pullCommand, listCommand] = commands;

let args = yargs
	.command(pullCommand, "Pull current menu of a canteen and put result to stdout.", {
		canteen: {
			type: "string",
			alias: "c",
			require: "The canteen to fetch"
		}
	}, async (args: {canteen: string}) => {
		try {
			const res = await requestMenu(args.canteen)
			printMenu(res);
		}
		catch (ex)
		{
			errorAndExit(ex);
		}
})
	.command(listCommand, "List available canteens", {}, (_: any) => list())
.help()
.argv;


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
