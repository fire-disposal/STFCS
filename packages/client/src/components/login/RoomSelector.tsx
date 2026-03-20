/**
 * 房间选择组件
 *
 * 支持三种模式：
 * 1. 快速加入 - 自动加入默认房间或人数最多的房间
 * 2. 选择房间 - 从已有房间列表中选择
 * 3. 创建房间 - 创建新的私人房间
 *
 * 新功能：
 * - 私密房间支持（密码）
 * - 房主显示
 * - 房间阶段显示
 */

import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { websocketService } from "@/services/websocket";
import { Lock, Crown, Users, Play, Pause, Circle, Zap, Home, Plus } from "lucide-react";

export interface RoomInfo {
	roomId: string;
	name: string;
	playerCount: number;
	maxPlayers: number;
	createdAt: number;
	isPrivate: boolean;
	hasPassword: boolean;
	phase: 'lobby' | 'deployment' | 'playing' | 'paused' | 'ended';
	ownerId: string | null;
}

interface RoomSelectorProps {
	selectedRoomId: string | null;
	onRoomSelect: (roomId: string, password?: string) => void;
	onRoomCreate: (options: RoomCreateOptions) => Promise<void>;
	disabled?: boolean;
}

export interface RoomCreateOptions {
	roomId: string;
	name?: string;
	maxPlayers: number;
	isPrivate: boolean;
	password?: string;
}

type SelectionMode = "quick" | "select" | "create";

export const RoomSelector: React.FC<RoomSelectorProps> = ({
	selectedRoomId,
	onRoomSelect,
	onRoomCreate,
	disabled = false,
}) => {
	const { t } = useTranslation();
	const [mode, setMode] = useState<SelectionMode>("quick");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [selectedPrivateRoom, setSelectedPrivateRoom] = useState<RoomInfo | null>(null);
	const [passwordInput, setPasswordInput] = useState("");
	const [newRoomId, setNewRoomId] = useState("");
	const [newRoomName, setNewRoomName] = useState("");
	const [newRoomMaxPlayers, setNewRoomMaxPlayers] = useState(8);
	const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
	const [newRoomPassword, setNewRoomPassword] = useState("");
	const [error, setError] = useState("");

	// 获取房间列表
	const fetchRooms = useCallback(async () => {
		if (!websocketService.isConnected()) return;

		setIsLoading(true);
		try {
			const result = await websocketService.sendRequest("room.list", {});
			if (result.rooms) {
				setRooms(result.rooms.map((r: any) => ({
					roomId: r.roomId,
					name: r.name || r.roomId,
					playerCount: r.playerCount,
					maxPlayers: r.maxPlayers,
					createdAt: r.createdAt,
					isPrivate: r.isPrivate ?? false,
					hasPassword: r.hasPassword ?? false,
					phase: r.phase ?? 'lobby',
					ownerId: r.ownerId ?? null,
				})));
			}
		} catch (err) {
			console.error("Failed to fetch rooms:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms]);

	// 处理房间选择
	const handleRoomSelect = useCallback((room: RoomInfo) => {
		if (room.hasPassword) {
			setSelectedPrivateRoom(room);
			setShowPasswordModal(true);
		} else {
			onRoomSelect(room.roomId);
		}
	}, [onRoomSelect]);

	// 处理密码提交
	const handlePasswordSubmit = useCallback((e: React.FormEvent) => {
		e.preventDefault();
		if (selectedPrivateRoom) {
			onRoomSelect(selectedPrivateRoom.roomId, passwordInput);
			setShowPasswordModal(false);
			setSelectedPrivateRoom(null);
			setPasswordInput("");
		}
	}, [selectedPrivateRoom, passwordInput, onRoomSelect]);

	// 处理创建房间
	const handleCreateRoom = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newRoomId.trim()) {
			setError(t("room.error.roomIdRequired"));
			return;
		}
		if (newRoomId.length > 32) {
			setError(t("room.error.roomIdTooLong"));
			return;
		}
		if (newRoomIsPrivate && !newRoomPassword) {
			setError(t("room.error.passwordRequired"));
			return;
		}

		setError("");
		setIsLoading(true);
		try {
			await onRoomCreate({
				roomId: newRoomId.trim(),
				name: newRoomName.trim() || newRoomId.trim(),
				maxPlayers: newRoomMaxPlayers,
				isPrivate: newRoomIsPrivate,
				password: newRoomIsPrivate ? newRoomPassword : undefined,
			});
			onRoomSelect(newRoomId.trim());
			setShowCreateForm(false);
			setNewRoomId("");
			setNewRoomName("");
			setNewRoomPassword("");
			setNewRoomIsPrivate(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	// 获取阶段图标
	const getPhaseIcon = (phase: RoomInfo['phase']) => {
		switch (phase) {
			case 'lobby': return <Circle size={12} className="rs-phase-icon rs-phase-icon--lobby" />;
			case 'deployment': return <Users size={12} className="rs-phase-icon rs-phase-icon--deployment" />;
			case 'playing': return <Play size={12} className="rs-phase-icon rs-phase-icon--playing" />;
			case 'paused': return <Pause size={12} className="rs-phase-icon rs-phase-icon--paused" />;
			case 'ended': return <Circle size={12} className="rs-phase-icon rs-phase-icon--ended" />;
			default: return null;
		}
	};

	// 获取阶段标签
	const getPhaseLabel = (phase: RoomInfo['phase']) => {
		return t(`room.phase.${phase}`);
	};

	return (
		<div className="rs-container">
			<div className="rs-modes">
				<label className={`rs-mode-option ${mode === "quick" ? "rs-mode-option--active" : ""}`}>
					<input
						type="radio"
						name="roomMode"
						value="quick"
						checked={mode === "quick"}
						onChange={() => {
							setMode("quick");
							onRoomSelect("default");
						}}
						disabled={disabled}
					/>
					<span className="rs-mode-label"><Zap size={14} /> {t("room.quickJoin")}</span>
					<span className="rs-mode-desc">{t("room.quickJoinDescription")}</span>
				</label>

				<label className={`rs-mode-option ${mode === "select" ? "rs-mode-option--active" : ""}`}>
					<input
						type="radio"
						name="roomMode"
						value="select"
						checked={mode === "select"}
						onChange={() => setMode("select")}
						disabled={disabled || rooms.length === 0}
					/>
					<span className="rs-mode-label"><Home size={14} /> {t("room.selectRoom")}</span>
					<span className="rs-mode-desc">
						{rooms.length > 0
							? t("room.selectRoomDescription", { count: rooms.length })
							: t("room.noRoomsAvailable")}
					</span>
				</label>

				<label className={`rs-mode-option ${mode === "create" ? "rs-mode-option--active" : ""}`}>
					<input
						type="radio"
						name="roomMode"
						value="create"
						checked={mode === "create"}
						onChange={() => {
							setMode("create");
							setShowCreateForm(true);
						}}
						disabled={disabled}
					/>
					<span className="rs-mode-label"><Plus size={14} /> {t("room.createRoom")}</span>
					<span className="rs-mode-desc">{t("room.createRoomDescription")}</span>
				</label>
			</div>

			{/* 房间列表 */}
			{mode === "select" && rooms.length > 0 && (
				<div className="rs-room-list">
					{rooms.map((room) => (
						<button
							key={room.roomId}
							className={`rs-room-card ${selectedRoomId === room.roomId ? "rs-room-card--selected" : ""} ${room.playerCount >= room.maxPlayers ? "rs-room-card--full" : ""}`}
							onClick={() => handleRoomSelect(room)}
							disabled={disabled || isLoading || room.playerCount >= room.maxPlayers}
							type="button"
						>
							<div className="rs-room-header">
								<span className="rs-room-name">
									{room.isPrivate && <Lock size={12} className="rs-private-icon" />}
									{room.name}
								</span>
								<span className="rs-room-players">
									<Users size={12} />
									{room.playerCount}/{room.maxPlayers}
								</span>
							</div>
							<div className="rs-room-info">
								<span className="rs-room-phase">
									{getPhaseIcon(room.phase)}
									{getPhaseLabel(room.phase)}
								</span>
								{room.ownerId && (
									<span className="rs-room-owner">
										<Crown size={10} />
										{room.ownerId}
									</span>
								)}
							</div>
						</button>
					))}
				</div>
			)}

			{/* 创建房间表单 */}
			{mode === "create" && showCreateForm && (
				<form className="rs-create-form" onSubmit={handleCreateRoom}>
					<div className="rs-form-group">
						<label htmlFor="newRoomId">{t("room.newRoomId")}</label>
						<input
							id="newRoomId"
							type="text"
							value={newRoomId}
							onChange={(e) => setNewRoomId(e.target.value)}
							placeholder={t("room.newRoomIdPlaceholder")}
							disabled={disabled || isLoading}
							maxLength={32}
							className="rs-input"
						/>
					</div>
					<div className="rs-form-group">
						<label htmlFor="newRoomName">{t("room.newRoomName")}</label>
						<input
							id="newRoomName"
							type="text"
							value={newRoomName}
							onChange={(e) => setNewRoomName(e.target.value)}
							placeholder={t("room.newRoomNamePlaceholder")}
							disabled={disabled || isLoading}
							maxLength={32}
							className="rs-input"
						/>
					</div>
					<div className="rs-form-group">
						<label htmlFor="maxPlayers">{t("room.maxPlayers")}</label>
						<input
							id="maxPlayers"
							type="number"
							value={newRoomMaxPlayers}
							onChange={(e) => setNewRoomMaxPlayers(parseInt(e.target.value) || 8)}
							min={2}
							max={16}
							disabled={disabled || isLoading}
							className="rs-input"
						/>
					</div>
					<div className="rs-form-group rs-form-group--checkbox">
						<label>
							<input
								type="checkbox"
								checked={newRoomIsPrivate}
								onChange={(e) => setNewRoomIsPrivate(e.target.checked)}
								disabled={disabled || isLoading}
							/>
							<Lock size={14} />
							{t("room.privateRoom")}
						</label>
					</div>
					{newRoomIsPrivate && (
						<div className="rs-form-group">
							<label htmlFor="roomPassword">{t("room.password")}</label>
							<input
								id="roomPassword"
								type="password"
								value={newRoomPassword}
								onChange={(e) => setNewRoomPassword(e.target.value)}
								placeholder={t("room.passwordPlaceholder")}
								disabled={disabled || isLoading}
								maxLength={32}
								className="rs-input"
							/>
						</div>
					)}
					{error && <div className="rs-error">{error}</div>}
					<button
						type="submit"
						disabled={disabled || isLoading || !newRoomId.trim()}
						className="btn btn-primary rs-create-btn"
					>
						{isLoading ? t("room.creating") : t("room.createButton")}
					</button>
				</form>
			)}

			{/* 密码输入模态框 */}
			{showPasswordModal && selectedPrivateRoom && (
				<div className="rs-modal-overlay">
					<div className="rs-modal">
						<h3 className="rs-modal-title">
							<Lock size={16} />
							{t("room.enterPassword")}
						</h3>
						<p className="rs-modal-desc">{t("room.privateRoomMessage", { name: selectedPrivateRoom.name })}</p>
						<form onSubmit={handlePasswordSubmit}>
							<input
								type="password"
								value={passwordInput}
								onChange={(e) => setPasswordInput(e.target.value)}
								placeholder={t("room.passwordPlaceholder")}
								className="rs-input"
								autoFocus
							/>
							<div className="rs-modal-actions">
								<button
									type="button"
									onClick={() => {
										setShowPasswordModal(false);
										setSelectedPrivateRoom(null);
										setPasswordInput("");
									}}
									className="btn btn-secondary"
								>
									{t("common.cancel")}
								</button>
								<button
									type="submit"
									disabled={!passwordInput}
									className="btn btn-primary"
								>
									{t("room.join")}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* 加载状态 */}
			{isLoading && mode !== "create" && (
				<div className="rs-loading">
					<div className="rs-spinner" />
					{t("room.loadingRooms")}
				</div>
			)}

			<style>{`
				.rs-container {
					display: flex;
					flex-direction: column;
					gap: var(--space-3);
				}

				.rs-modes {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
				}

				.rs-mode-option {
					display: flex;
					flex-direction: column;
					gap: var(--space-1);
					padding: var(--space-3);
					background: rgba(20, 25, 35, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.2);
					border-radius: var(--radius-sm);
					cursor: pointer;
					transition: var(--transition-fast);
				}

				.rs-mode-option:hover {
					background: rgba(30, 35, 45, 0.7);
					border-color: rgba(74, 158, 255, 0.3);
				}

				.rs-mode-option--active {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.4);
				}

				.rs-mode-option input {
					display: none;
				}

				.rs-mode-label {
					font-size: var(--text-sm);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
				}

				.rs-mode-desc {
					font-size: var(--text-xs);
					color: var(--text-tertiary);
				}

				/* 房间列表 */
				.rs-room-list {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
					max-height: 200px;
					overflow-y: auto;
				}

				.rs-room-card {
					display: flex;
					flex-direction: column;
					gap: var(--space-1);
					padding: var(--space-3);
					background: rgba(20, 25, 35, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.2);
					border-radius: var(--radius-sm);
					cursor: pointer;
					transition: var(--transition-fast);
					text-align: left;
				}

				.rs-room-card:hover:not(:disabled) {
					background: rgba(30, 35, 45, 0.7);
					border-color: rgba(74, 158, 255, 0.4);
				}

				.rs-room-card--selected {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.5);
				}

				.rs-room-card--full {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.rs-room-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.rs-room-name {
					display: flex;
					align-items: center;
					gap: var(--space-1);
					font-size: var(--text-sm);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
				}

				.rs-private-icon {
					color: var(--color-warning);
				}

				.rs-room-players {
					display: flex;
					align-items: center;
					gap: var(--space-1);
					font-size: var(--text-xs);
					color: var(--text-secondary);
				}

				.rs-room-info {
					display: flex;
					justify-content: space-between;
					align-items: center;
					font-size: var(--text-xs);
					color: var(--text-tertiary);
				}

				.rs-room-phase {
					display: flex;
					align-items: center;
					gap: var(--space-1);
				}

				.rs-phase-icon--lobby { color: var(--text-tertiary); }
				.rs-phase-icon--deployment { color: var(--color-warning); }
				.rs-phase-icon--playing { color: var(--color-success); }
				.rs-phase-icon--paused { color: var(--color-warning); }
				.rs-phase-icon--ended { color: var(--text-tertiary); }

				.rs-room-owner {
					display: flex;
					align-items: center;
					gap: 2px;
					color: var(--color-primary);
				}

				/* 创建表单 */
				.rs-create-form {
					display: flex;
					flex-direction: column;
					gap: var(--space-3);
					padding: var(--space-3);
					background: rgba(20, 25, 35, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.2);
					border-radius: var(--radius-sm);
				}

				.rs-form-group {
					display: flex;
					flex-direction: column;
					gap: var(--space-1);
				}

				.rs-form-group label {
					font-size: var(--text-xs);
					color: var(--text-secondary);
				}

				.rs-form-group--checkbox label {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					cursor: pointer;
				}

				.rs-input {
					width: 100%;
					padding: var(--space-2) var(--space-3);
					background: rgba(0, 0, 0, 0.5);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					color: var(--text-primary);
					font-size: var(--text-sm);
					transition: var(--transition-fast);
					outline: none;
				}

				.rs-input:focus {
					border-color: var(--border-color-active);
					box-shadow: var(--shadow-glow-sm);
				}

				.rs-error {
					font-size: var(--text-xs);
					color: var(--color-danger);
					padding: var(--space-2);
					background: rgba(255, 68, 68, 0.1);
					border-radius: var(--radius-sm);
				}

				.rs-create-btn {
					width: 100%;
				}

				/* 模态框 */
				.rs-modal-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.6);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: var(--z-modal-backdrop);
				}

				.rs-modal {
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-md);
					padding: var(--space-4);
					min-width: 300px;
					max-width: 400px;
				}

				.rs-modal-title {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-base);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
					margin: 0 0 var(--space-2) 0;
				}

				.rs-modal-desc {
					font-size: var(--text-sm);
					color: var(--text-secondary);
					margin: 0 0 var(--space-3) 0;
				}

				.rs-modal-actions {
					display: flex;
					justify-content: flex-end;
					gap: var(--space-2);
					margin-top: var(--space-3);
				}

				/* 加载状态 */
				.rs-loading {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-2);
					color: var(--text-tertiary);
					font-size: var(--text-xs);
				}

				.rs-spinner {
					width: 12px;
					height: 12px;
					border: 2px solid rgba(74, 158, 255, 0.3);
					border-top-color: var(--color-primary);
					border-radius: 50%;
					animation: rs-spin 0.8s linear infinite;
				}

				@keyframes rs-spin {
					to { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
};

export default RoomSelector;