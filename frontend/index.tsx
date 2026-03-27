import { Millennium, IconsModule, definePlugin, Field, DialogButton, callable } from '@steambrew/client';

class classname {
	static method(country: string, age: number) {
		console.log(`age: ${age}, country: ${country}`);
	}
}

const receiveBackendMethod = callable<[{ message: string; status: boolean; count: number }], number>('Backend.test_frontend_message_callback');

export default definePlugin(() => {
	classname.method("USA", 25);

	const onClick = async () => {
		const result = await receiveBackendMethod({ message: "hello from frontend!", status: true, count: 420 });
		console.log('Backend returned:', result);
	};

	return {
		title: <div>Example Plugin</div>,
		icon: <IconsModule.Settings />,
		content: (
			<>
				<Field
					label="Call backend"
					description="Sends a message to the python backend"
					icon={null}
				>
					<DialogButton onClick={onClick}>
						Call Backend
					</DialogButton>
				</Field>
			</>
		),
	};
});
