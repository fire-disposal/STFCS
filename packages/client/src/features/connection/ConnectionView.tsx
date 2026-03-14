import React, { useState } from "react";
import { useAppDispatch } from "@/store";
import { setServerUrl, addSystemMessage } from "@/store/slices/uiSlice";

interface ConnectionViewProps {
	serverUrl: string;
	isConnecting: boolean;
	onConnect: (url: string) => Promise<void>;
}

const ConnectionView: React.FC<ConnectionViewProps> = ({
	serverUrl,
	isConnecting,
	onConnect,
}) => {
	const dispatch = useAppDispatch();
	const [url, setUrl] = useState(serverUrl);
	const [playerName, setPlayerName] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!url.trim() || !playerName.trim()) {
			dispatch(addSystemMessage("Please enter server URL and player name"));
			return;
		}

		try {
			await onConnect(url);
			dispatch(setServerUrl(url));
			dispatch(addSystemMessage(`Connected to ${url} as ${playerName}`));
		} catch (error) {
			dispatch(addSystemMessage(`Failed to connect: ${error}`));
		}
	};

	return (
		<div className="connection-view">
			<div className="connection-card">
				<h2>Connect to Server</h2>
				<p className="connection-description">
					Enter the WebSocket server URL and your player name to join the game.
				</p>

				<form onSubmit={handleSubmit} className="connection-form">
					<div className="form-group">
						<label htmlFor="serverUrl">Server URL</label>
						<input
							id="serverUrl"
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="ws://localhost:3001"
							disabled={isConnecting}
							className="form-input"
						/>
						<small className="form-help">
							Default: ws://localhost:3001
						</small>
					</div>

					<div className="form-group">
						<label htmlFor="playerName">Player Name</label>
						<input
							id="playerName"
							type="text"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							placeholder="Enter your name"
							disabled={isConnecting}
							className="form-input"
							maxLength={32}
						/>
						<small className="form-help">
							Maximum 32 characters
						</small>
					</div>

					<div className="form-actions">
						<button
							type="submit"
							disabled={isConnecting || !url.trim() || !playerName.trim()}
							className="connect-button"
						>
							{isConnecting ? (
								<>
									<span className="spinner"></span>
									Connecting...
								</>
							) : (
								"Connect"
							)}
						</button>
					</div>
				</form>

				<div className="connection-info">
					<h3>Quick Start</h3>
					<ul>
						<li>Ensure the STFCS server is running on port 3001</li>
						<li>Use "ws://localhost:3001" for local development</li>
						<li>Player names must be unique in each room</li>
						<li>You can change rooms after connecting</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default ConnectionView;
