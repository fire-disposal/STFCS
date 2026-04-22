import type { UserProfile } from "../types.js";
import { FileBaseRepository } from "./FileBaseRepository.js";

export class FileUserRepository extends FileBaseRepository<UserProfile> {
	constructor() {
		super("profile");
	}

	protected getFileName(entity: UserProfile): string {
		return `${entity.id}.json`;
	}

	protected extractPlayerId(entity: UserProfile): string {
		return entity.id.replace(/^player_/, "");
	}

	async findByRole(role: string): Promise<UserProfile[]> {
		return this.findBy({ role: role as UserProfile["role"] });
	}
}