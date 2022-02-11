class TextureUtils {
	static async makeAtlases(engine, atlasConfig) {
		const flattened = TextureUtils.flattenAtlases(atlasConfig || {}, [], []);
		const atlases = await Promise.all(flattened.map(config => engine.addTexture(config)));
		const atlas = {};
		atlases.forEach(textureAtlas => {
			const idSplit = textureAtlas.id.split(".");
			let root = atlas, id = idSplit[0];
			for (let i = 1; i < idSplit.length; i++) {
				if (!root[id]) {
					root[id] = {};
				}
				root = root[id];
				id = idSplit[i];
			}
			root[id] = textureAtlas;
			atlas[textureAtlas.id] = textureAtlas;
		});
		return atlas;
	}

	static getAnimFromAtlas(atlas, anim) {
		if (typeof(anim) !== "string") {
			return anim;
		}
		const idSplit = anim.split(".");
		let root = atlas;
		for (let i = 0; i < idSplit.length; i++) {
			root = root[idSplit[i]];
		}
		if (!root) {
			console.warn("Anim doesn't exist: ", anim, " in ", atlas);
		}
		return root;
	}


	static flattenAtlases(object, path, array) {
		if (!path) {
			path = [];
		}
		if (!array) {
			array = [];
		}
		if (Array.isArray(object)) {
			object.forEach((o, index) => {
				TextureUtils.flattenAtlases(o, path.concat(index), array);
			});
		} else if (object.url) {	//	is atlas
			array.push({id: path.join("."), ...object});
			return array;
		} else if (typeof(object) === "object") {
			Object.keys(object).forEach(id => {
				TextureUtils.flattenAtlases(object[id], path.concat(id), array);
			});
		} else {
			console.warn("What is object? => ", object)
		}
		return array;
	}
}

module.exports = {
	TextureUtils,
};
