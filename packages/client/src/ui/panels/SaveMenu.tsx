/**
 * SaveMenu - 存档菜单组件
 */

import React, { useState, useCallback, useEffect } from "react";
import { Save, Trash2, Download, Loader2, Plus } from "lucide-react";
import { Dialog, AlertDialog, Flex, Box, Text, Button, IconButton, TextField, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import type { SaveBuild } from "@vt/data";
import "./save-menu.css";

interface SaveMenuProps {
	isHost: boolean;
	inRoom: boolean;
}

export const SaveMenu: React.FC<SaveMenuProps> = ({ isHost, inRoom }) => {
	const [open, setOpen] = useState(false);
	const [saves, setSaves] = useState<SaveBuild[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [newSaveName, setNewSaveName] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<{ saveId: string; name: string } | null>(null);

	const { send } = useGameAction();

	const loadSaves = useCallback(async () => {
		setLoading(true);
		try {
			const result = await send("save:action", { action: "list" });
			if (!result) {
				notify.error("加载存档列表失败");
				return;
			}
			if ("saves" in result) setSaves(result.saves);
		} finally {
			setLoading(false);
		}
	}, [send]);

	useEffect(() => {
		if (open) {
			loadSaves();
		}
	}, [open, loadSaves]);

	const handleCreate = useCallback(async () => {
		if (!newSaveName.trim()) {
			notify.error("请输入存档名称");
			return;
		}

		setSaving(true);
		try {
			const result = await send("save:action", { action: "create", name: newSaveName.trim() });
			if (!result) return;
			setNewSaveName("");
			setShowCreate(false);
			void loadSaves();
		} finally {
			setSaving(false);
		}
	}, [newSaveName, send, loadSaves]);

	const handleLoad = useCallback(async (saveId: string) => {
		if (!inRoom || !isHost) {
			notify.error("只有房主在房间内可加载存档");
			return;
		}

		setSaving(true);
		try {
			const result = await send("save:action", { action: "load", saveId });
			if (!result) return;
			notify.success("存档已载入");
			setOpen(false);
		} finally {
			setSaving(false);
		}
	}, [inRoom, isHost, send]);

	const handleDelete = useCallback(async (saveId: string) => {
		setSaving(true);
		try {
			const result = await send("save:action", { action: "delete", saveId });
			if (!result) return;
			notify.success("存档已删除");
			void loadSaves();
		} finally {
			setSaving(false);
		}
	}, [send, loadSaves]);

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<>
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger>
				<button className="top-bar__action-btn" title="存档">
					<Save size={16} />
					存档
				</button>
			</Dialog.Trigger>

			<Dialog.Content className="save-menu-dialog" style={{ maxWidth: 480 }}>
				<Dialog.Title>
					<Flex align="center" gap="2">
						<Save size={16} />
						<Text>存档管理</Text>
					</Flex>
				</Dialog.Title>

				<Box className="save-menu-content">
					<Flex justify="between" align="center" mb="3">
						<Text size="1" color="gray">
							共 {saves.length} 个存档
						</Text>
						<Button size="1" variant="soft" onClick={() => setShowCreate(!showCreate)}>
							<Plus size={12} />
							新建存档
						</Button>
					</Flex>

					{showCreate && (
						<Flex className="save-create-form" gap="2" mb="3">
							<TextField.Root
								size="1"
								placeholder="存档名称"
								value={newSaveName}
								onChange={(e) => setNewSaveName(e.target.value)}
								style={{ flex: 1 }}
							/>
							<Button size="1" variant="solid" onClick={handleCreate} disabled={saving}>
								{saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
								保存
							</Button>
						</Flex>
					)}

					{loading ? (
						<Flex justify="center" align="center" py="4">
							<Loader2 size={16} className="spin" />
						</Flex>
					) : saves.length === 0 ? (
						<Flex justify="center" align="center" py="4">
							<Text size="1" color="gray">暂无存档</Text>
						</Flex>
					) : (
						<Box className="save-list">
							{saves.map((save) => (
								<Flex
									key={save.$id}
									className="save-item"
									align="center"
									gap="3"
									justify="between"
								>
									<Box className="save-item-info">
										<Text size="1" weight="bold">{save.metadata?.name ?? "未命名存档"}</Text>
										<Flex gap="2" align="center">
											<Text size="1" color="gray">
												{save.createdAt ? formatDate(save.createdAt) : "未知时间"}
											</Text>
											<Badge size="1" color="gray">
												{save.snapshot?.tokens ? Object.keys(save.snapshot.tokens).length : 0} 舰船
											</Badge>
										</Flex>
									</Box>

									<Flex gap="1">
										<IconButton
											size="1"
											variant="soft"
											color="blue"
											onClick={() => handleLoad(save.$id)}
											disabled={!inRoom || !isHost || saving}
											title={isHost ? "加载到当前房间" : "仅房主可加载"}
										>
											<Download size={12} />
										</IconButton>
										<IconButton
											size="1"
											variant="soft"
											color="red"
											onClick={() => setPendingDelete({ saveId: save.$id, name: save.metadata?.name ?? "未命名" })}
											disabled={saving}
											title="删除"
											aria-label="删除存档"
										>
											<Trash2 size={12} />
										</IconButton>
									</Flex>
								</Flex>
							))}
						</Box>
					)}
				</Box>

				<Dialog.Close>
					<Button variant="soft" size="1">
						关闭
					</Button>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>

		<AlertDialog.Root open={pendingDelete !== null} onOpenChange={(next) => { if (!next) setPendingDelete(null); }}>
			<AlertDialog.Content style={{ maxWidth: 380 }}>
				<AlertDialog.Title>删除存档</AlertDialog.Title>
				<AlertDialog.Description size="2">
					确定删除「{pendingDelete?.name}」？此操作不可撤销。
				</AlertDialog.Description>
				<Flex justify="end" gap="2" mt="4">
					<AlertDialog.Cancel>
						<Button variant="soft" color="gray" size="1">取消</Button>
					</AlertDialog.Cancel>
					<AlertDialog.Action>
						<Button
							variant="solid"
							color="red"
							size="1"
							disabled={saving}
							onClick={() => {
								if (pendingDelete) void handleDelete(pendingDelete.saveId);
								setPendingDelete(null);
							}}
						>
							删除
						</Button>
					</AlertDialog.Action>
				</Flex>
			</AlertDialog.Content>
		</AlertDialog.Root>
		</>
	);
};

export default SaveMenu;