declare module "sharp" {
	interface Metadata {
		width?: number;
		height?: number;
		format?: string;
		channels?: number;
		density?: number;
		size?: number;
		[key: string]: unknown;
	}

	interface Sharp {
		metadata(): Promise<Metadata>;
		png(options?: Record<string, unknown>): Sharp;
		toBuffer(): Promise<Buffer>;
	}

	function sharp(input: Buffer | string): Sharp;
	export default sharp;
}
