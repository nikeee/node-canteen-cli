// TODO: Documentation/JSDoc

interface PullArgs {
	canteen: string;
}

interface IMenuParser<T> {
	parse(canteen: ICanteenItem, response: string): IParseResult<T>;
}

interface ICanteenList {
	[key: string]: ICanteenItem;
}

interface ICanteenItem {
	info: ICanteenInfo;
	url: string;
	parser: IMenuParser<ICanteenMenu>;
	mealCount: number;
}

interface ICanteenInfo {
	name: string;
	locationDescription?: string;
	location?: { lat: number; long: number };
}

interface IMeals {
	[genericName: string]: { [dayOfWeek: number]: IMealItem | null; };
}

interface IMealItem {
	name: string;
	attributes: string[]
	price: IPriceItem;
	vitalInfo: IMensaVitalItem | null;
}
interface ITransposedMealItem extends IMealItem {
	categoryName: string;
}

interface IPriceItem {
	student: number;
	employee: number;
	visitor: number;
}

interface ICanteenMenu {
	info: ICanteenInfo;
	validity: IMenuValidity;
	currency: string;
	meals: IMeals;
}

interface ITransposedCanteenMenu {
	info: ICanteenInfo;
	validity: IMenuValidity;
	currency: string;
	days: ITransposedMealItem[][];
}

interface IMensaVitalItem {
	// Maybe add a units later
	protein: number;
	fat: number;
	calories: number;
	carbohydrate: number;
}

interface IMenuValidity {
	from: Date;
	until: Date;
}

interface IParseResult<T> {
	success: boolean;
	message?: string;
	menu: T;
}
