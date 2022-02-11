const { DirectData } = require("direct-data");


const TEXTURE_EDGE_CALCULATOR_DATA_PATH = "texture/texture-edge-data.json";

class TextureEdgeCalculator {
	constructor(assetMd5) {
		this.assetMd5 = assetMd5 || {};
		this.directData = new DirectData();
		this.textureEdgeData = {};
		this.canvas = document.createElement("canvas");
	}

	async init() {
		try {
			this.textureEdgeData = await this.directData.getData(TEXTURE_EDGE_CALCULATOR_DATA_PATH) || {};
		} catch (e) {
			console.error("Failed to load texure edge data", e);
		}
		const allMd5 = new Set();
		Object.values(this.assetMd5).forEach(md5 => allMd5.add(md5));
		for (let md5 in this.textureEdgeData) {
			if (!allMd5.has(md5)) {
				delete this.textureEdgeData[md5];
				this.directData.didChange(TEXTURE_EDGE_CALCULATOR_DATA_PATH);
			}
		}
	}

	calculateCollisionBoxes(collision_url, cols, rows, collisionImage) {
		const tag = assetMd5[collision_url.split("/").pop()];
		if (this.textureEdgeData[tag]) {
			return this.textureEdgeData[tag];
		}
		console.log("Calculating collision box on: " + collision_url + "(" + tag + ")");
		const canvas = this.canvas;
		const collisionBoxes = [];
		canvas.width = collisionImage.naturalWidth;
		canvas.height = collisionImage.naturalHeight;
		const context = canvas.getContext("2d");
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(collisionImage, 0, 0);

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const cellWidth = canvas.width / cols;
				const cellHeight = canvas.height / rows;
				const cellX = col * cellWidth;
				const cellY = row * cellHeight;
				const top = TextureEdgeCalculator.getTop(context, cellX, cellY, cellWidth, cellHeight);
				if (top < 0) {
					continue;
				}
				const bottom = TextureEdgeCalculator.getBottom(context, cellX, cellY, cellWidth, cellHeight) + 1;
				const left = TextureEdgeCalculator.getLeft(context, cellX, cellY, cellWidth, cellHeight);
				const right = TextureEdgeCalculator.getRight(context, cellX, cellY, cellWidth, cellHeight) + 1;
				if (top >= 0 && bottom >= 0 && left >= 0 && right >= 0) {
					collisionBoxes[row * cols + col] = {
						collision_url,
						updated: new Date(),
						top: top / cellHeight,
						left: left / cellWidth,
						bottom: bottom / cellHeight,
						right: right / cellWidth,
						close: 0, far: 1,
					};
				}
			}
		}

		this.textureEdgeData[tag] = collisionBoxes;
		this.directData.didChange(TEXTURE_EDGE_CALCULATOR_DATA_PATH);
		return collisionBoxes;
	}	

	static getTop(context, x, y, width, height) {
		for (let top = 0; top < height; top ++) {
			const pixels = context.getImageData(x, y + top, width, 1).data;
			if (TextureEdgeCalculator.hasOpaquePixel(pixels)) {
				return top;
			}
		}
		return -1;
	}

	static getBottom(context, x, y, width, height) {
		for (let bottom = height-1; bottom >=0; bottom --) {
			const pixels = context.getImageData(x, y + bottom, width, 1).data;
			if (TextureEdgeCalculator.hasOpaquePixel(pixels)) {
				return bottom;
			}
		}
		return -1;
	}

	static getLeft(context, x, y, width, height) {
		for (let left = 0; left < width; left ++) {
			const pixels = context.getImageData(x + left, y, 1, height).data;
			if (TextureEdgeCalculator.hasOpaquePixel(pixels)) {
				return left;
			}
		}
		return -1;		
	}

	static getRight(context, x, y, width, height) {
		for (let right = width-1; right >=0; right--) {
			const pixels = context.getImageData(x + right, y, 1, height).data;
			if (TextureEdgeCalculator.hasOpaquePixel(pixels)) {
				return right;
			}
		}
		return -1;
	}

	static hasOpaquePixel(pixels) {
		for (let i = 0; i < pixels.length; i+= 4) {
			if (pixels[i + 3]) {
				return true;
			}
		}
		return false;
	}	
}

module.exports = {
	TextureEdgeCalculator,
};
