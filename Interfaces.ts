// TODO: Documentation/JSDoc

interface PullArgs
{
	canteen: string;
}

interface IMenuParser
{
	parse(canteen: ICanteenItem, response: string): IParseResult;
}

interface ICanteenList
{
	[key: string]: ICanteenItem;
}

interface ICanteenItem
{
	info: ICanteenInfo;
	url: string;
	parser: IMenuParser;
	mealCount: number;
}

interface ICanteenInfo
{
	name: string;
	locationDescription?: string;
	location?: { lat: number; long: number };
}

interface IMeals
{
	[genericName: string]: { [dayOfWeek: number]: IMealItem | null };
}

interface IMealItem
{
	name: string;
	attributes: string[]
	price: IPriceItem;
	vitalInfo: IMensaVitalItem | null;
}

interface IPriceItem
{
	student: number;
	employee: number;
	visitor: number;
}

interface ICanteenMenu
{
	info: ICanteenInfo;
	validity: IMenuValidity;
	currency: string;
	meals: IMeals;
}

interface IMensaVitalItem
{
	// Maybe add a units later
	protein: number;
	fat: number;
	calories: number;
	carbohydrate: number;
}

interface IMenuValidity
{
	from: Date;
	until: Date;
}

interface IParseResult
{
	success: boolean;
	message?: string;
	menu: ICanteenMenu;
}
