
export default class Parsers
{
	public static fixDateOffset(d: Date): Date
	{
		d.setHours(d.getHours() - d.getTimezoneOffset() / 60);
		return d;
	}
}
