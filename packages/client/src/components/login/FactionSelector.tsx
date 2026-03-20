/**
 * 阵营选择组件
 *
 * 显示两个阵营卡片（联邦和帝国），用户点击选择
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Swords, Check } from 'lucide-react';
import type { FactionId } from '@vt/shared/types';
import { FACTIONS, getFactionList } from '@vt/shared/constants';

interface FactionSelectorProps {
	selectedFaction: FactionId | null;
	onFactionSelect: (faction: FactionId) => void;
	disabled?: boolean;
}

export const FactionSelector: React.FC<FactionSelectorProps> = ({
	selectedFaction,
	onFactionSelect,
	disabled = false,
}) => {
	const { t, i18n } = useTranslation();
	const factions = getFactionList();

	return (
		<div className="faction-selector">
			<label className="faction-selector-label">
				{t('faction.selectFaction')}
			</label>
			<div className="faction-cards">
				{factions.map((faction) => (
					<div
						key={faction.id}
						className={`faction-card ${selectedFaction === faction.id ? 'selected' : ''}`}
						onClick={() => !disabled && onFactionSelect(faction.id)}
						style={{
							borderColor: selectedFaction === faction.id ? faction.color : undefined,
						}}
					>
						<div
							className="faction-icon"
							style={{ backgroundColor: faction.color }}
						>
							{faction.icon === 'shield' ? <Shield size={24} /> : <Swords size={24} />}
						</div>
						<div className="faction-info">
							<span className="faction-name">
								{faction.nameLocalized[i18n.language as 'zh' | 'en'] || faction.name}
							</span>
							<span className="faction-description">
								{i18n.language === 'zh'
									? t(`faction.${faction.id}Description`)
									: faction.description}
							</span>
						</div>
						{selectedFaction === faction.id && (
							<div className="faction-selected-indicator"><Check size={16} /></div>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default FactionSelector;