const { TextureAtlas } = require("./texture-atlas");
const { TextureEdgeCalculator } = require("./texture-edge-calculator");
const { ImageLoader } = require('dok-file-utils');

class TextureManager {
	constructor(gl, textureUniformLocation, imageLoader, assetMd5) {
		this.gl = gl;
		this.textureEdgeCalculator = new TextureEdgeCalculator(assetMd5);
		this.imageLoader = imageLoader || new ImageLoader();
		this.glTextures = [];
		this.textureSize = 4096;
		this.maxTextureIndex = 0;
		this.urlToTextureIndex = {};
		this.nextTextureIndex = 0;
		this.activeTexture = -1;

		this.glTextures = this.initTextureLocation(gl, textureUniformLocation);
		this.fullTextures = this.glTextures.map((_, index) => this.createAtlas(index).setFullTexture());
		this.textureFills = this.glTextures.map(() => 0);
		this.canvas = document.createElement("canvas");
	}

	async init() {
		return this.textureEdgeCalculator.init();
	}

	activateTexture(index) {
		if (this.activeTexture !== index) {
			this.gl.activeTexture(this.gl[`TEXTURE${index}`]);
			this.activeTexture = index;
		}
	}

	initTextureLocation(gl, textureUniformLocation) {
		const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
		const arrayOfTextureIndex = new Array(maxTextureUnits).fill(null).map((a, index) => index);	//	0, 1, 2, 3... 16
		const glTextures = arrayOfTextureIndex.map(index => {
			const texture = gl.createTexture();
			const width = 1, height = 1;
			this.activateTexture(index);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			return { texture, width, height };
		});

		gl.uniform1iv(textureUniformLocation, arrayOfTextureIndex);
		return glTextures;
	}

	createAtlas(index, xOffset, yOffset) {
		return new TextureAtlas(this, index, xOffset, yOffset);
	}

	clear() {
		this.maxTextureIndex = 0;
		this.nextTextureIndex = 0;
		this.urlToTextureIndex = {};
		this.textureFills.fill(0);
		this.activeTexture = -1;
	}

	saveTexture(index, x, y, canvas) {
		const { gl, glTextures, textureSize } = this;
		this.maxTextureIndex = Math.max(index, this.maxTextureIndex);
		this.activateTexture(index);
		const glTexture = glTextures[index];
		if (glTexture.width < textureSize || glTexture.height < textureSize) {
			gl.bindTexture(gl.TEXTURE_2D, glTexture.texture);
			glTexture.width = glTexture.height = textureSize;
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glTexture.width, glTexture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	  		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	  		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	  		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
		}
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x || 0, y || 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
		gl.generateMipmap(gl.TEXTURE_2D);
	}

	async addTexture(imageConfig) {
		const { url, collision_url, texture_url } = imageConfig;
		const [image, textureImage, collisionImage] = await Promise.all([url,texture_url, collision_url].map(u => this.imageLoader.loadImage(u)));

		const imageHeight = image?.naturalHeight || 0;
		const fitInCurrentTexture = this.textureFills[this.nextTextureIndex] + imageHeight <= this.textureSize;

		const index = !url ? -1 
						: this.urlToTextureIndex[url]
						? this.urlToTextureIndex[url].index
						: fitInCurrentTexture
						? this.nextTextureIndex
						: ++this.nextTextureIndex;
		const yOffset = this.urlToTextureIndex[url] ? this.urlToTextureIndex[url].yOffset : this.textureFills[this.nextTextureIndex];

		if (!this.urlToTextureIndex[url]) {
			this.urlToTextureIndex[url] = { index, yOffset };
			this.textureFills[this.nextTextureIndex] += imageHeight;
		}

		return this.createAtlas(index, 0, yOffset).setImage(imageConfig, image, textureImage, collisionImage);
	}

	textureMix(image, texture, texture_alpha, texture_blend) {
		const canvas = this.canvas;
		const context = canvas.getContext("2d");
		if (canvas !== image) {
			this.getCanvasImage(image, canvas);
		}
		context.globalCompositeOperation = texture_blend || "source-atop";
		context.globalAlpha = texture_alpha || .5;

		const scale = Math.max(1, Math.max((image.naturalWidth || image.width) / texture.naturalWidth, (image.naturalHeight || image.height) / texture.naturalHeight));
		context.drawImage(texture, 0, 0, texture.naturalWidth, texture.naturalHeight, 0, 0, texture.naturalWidth * scale, texture.naturalHeight * scale);

		context.globalCompositeOperation = "";
		context.globalAlpha = 1;
		return canvas;
	}

	getCanvasImage(image, canvas) {
		const sourceWidth = image.naturalWidth || image.width;
		const sourceHeight = image.naturalHeight || image.height;
		canvas.width = sourceWidth;
		canvas.height = sourceHeight;

		const context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
		return canvas;
	}
}

module.exports = {
	TextureManager,
};

globalThis.TextureManager = TextureManager;
