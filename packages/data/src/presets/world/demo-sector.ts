export default 
{
	"name": "演示星域",
	"nodes": [
		{
			"id": "起点",
			"name": "星门站",
			"type": "safe_haven",
			"position": { "x": 0, "y": 0 },
			"explored": true,
			"state": "safe",
			"description": "一个中型空间站，是这片星域的主要贸易枢纽。",
			"tags": ["起点", "安全"]
		},
		{
			"id": "矿区",
			"name": "克雷斯特矿区",
			"type": "star_system",
			"position": { "x": 200, "y": -150 },
			"explored": false,
			"state": "threat",
			"description": "富含矿藏的小行星带，最近有海盗活动。",
			"hiddenDescription": "海盗在此建立了隐蔽基地，拥有3艘护卫舰。",
			"terrainProfile": { "density": 0.4, "preferredTypes": ["asteroid", "debris"] },
			"tags": ["矿区", "海盗"]
		},
		{
			"id": "nebula",
			"name": "迷雾星云",
			"type": "nebula",
			"position": { "x": -180, "y": -120 },
			"explored": false,
			"state": "threat",
			"description": "一片稠密的星际尘埃云，传感器在这里几乎失效。",
			"hiddenDescription": "星云深处有一座废弃的研究站。",
			"terrainProfile": { "density": 0.6, "preferredTypes": ["nebula"] },
			"tags": ["探索"]
		},
		{
			"id": "station2",
			"name": "前哨-7",
			"type": "waypoint",
			"position": { "x": 250, "y": 100 },
			"explored": false,
			"state": "safe",
			"description": "一座小型军事前哨站，可以提供基本维修服务。",
			"tags": ["维修", "补给"]
		},
		{
			"id": "废墟",
			"name": "远古废墟",
			"type": "anomaly",
			"position": { "x": -100, "y": 180 },
			"explored": false,
			"state": "threat",
			"description": "轨道上有不明残骸，能量读数异常。",
			"hiddenDescription": "这是某次超空间事故的现场，可能残留有珍贵科技。",
			"tags": ["遗迹", "高风险"]
		}
	],
	"edges": [
		{ "id": "e1", "from": "起点", "to": "矿区", "type": "trade_route", "travelCost": 2, "encounterChance": 0.3 },
		{ "id": "e2", "from": "起点", "to": "nebula", "type": "unexplored", "travelCost": 3, "encounterChance": 0.4 },
		{ "id": "e3", "from": "起点", "to": "station2", "type": "trade_route", "travelCost": 1, "encounterChance": 0.1 },
		{ "id": "e4", "from": "起点", "to": "废墟", "type": "perilous", "travelCost": 2, "encounterChance": 0.5 },
		{ "id": "e5", "from": "矿区", "to": "station2", "type": "perilous", "travelCost": 1, "encounterChance": 0.2 },
		{ "id": "e6", "from": "nebula", "to": "废墟", "type": "hidden", "travelCost": 1, "encounterChance": 0.6, "hidden": true }
	],
	"fleetNodeId": "起点",
	"nodeHistory": ["起点"],
	"timeline": { "currentDay": 1 }
}
