import { api } from "encore.dev/api";
import { db } from "@users/database/database";
import { User } from "@users/types";

interface ListUsersResponse {
    users: User[];
}

export const list = api(
    { expose: true, method: "GET", path: "/users" },
    async (): Promise<ListUsersResponse> => {
        const users: User[] = [];
        const rows = await db.query<User>`
            SELECT id, email, name, stripe_customer_id, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `;

        for await (const user of rows) {
            users.push(user);
        }

        return { users };
    }
);

