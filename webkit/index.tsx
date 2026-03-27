import { callable } from '@steambrew/webkit';

const receiveFrontendMethod = callable<[{ message: string; status: boolean; count: number }], boolean>('Backend.receive_frontend_message');

export default async function WebkitMain() {
	console.log("WebkitMain called");
	const result = await receiveFrontendMethod({ message: "hello from webkit!", status: true, count: 420 });
	console.log('Backend returned:', result);
}
