let counter = 100;

export function generateShortId(): string {
	counter = (counter % 999) + 1;
	return `#${counter.toString().padStart(3, "0")}`;
}

export function isValidShortId(id: string): boolean {
	return /^#\d{3}$/.test(id);
}