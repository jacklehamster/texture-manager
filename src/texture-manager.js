const { TextureAtlas } = require("./texture-atlas");
const { TextureEdgeCalculator } = require("./texture-edge-calculator");
const { SlotAllocator } = require('./slot-allocator');
const { ImageLoader } = require('dok-file-utils');

const DEFAULT_CONFIG = {
	autoMipMap: true,
	delayMipMap: 0,
};

class TextureManager {
	constructor(gl, textureUniformLocation, imageLoader, assetMd5, config) {
		this.gl = gl;
		this.textureEdgeCalculator = new TextureEdgeCalculator(assetMd5);
		this.imageLoader = imageLoader || new ImageLoader();
		this.glTextures = [];
		this.textureSize = 4096;
		this.maxTextureIndex = 0;
		this.urlToTextureIndex = {};
		this.activeTexture = -1;

		this.tempMatrix = new Float32Array([
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]);
		this.shortVec4 = new Uint16Array(4);
		this.floatVec4 = new Float32Array(4);

		this.glTextures = this.initTextureLocation(gl, textureUniformLocation);
		this.fullTextures = this.glTextures.map((_, index) => this.createAtlas(index).setFullTexture());
		this.slotAllocator = new SlotAllocator(this.glTextures.length, this.textureSize);
		this.canvas = document.createElement("canvas");
		this.config = {
			...DEFAULT_CONFIG,
			...config,
		};
		this.mipmapListeners = new Set();
		this.mipmapToGenerate = new Set();
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
		this.urlToTextureIndex = {};
		this.slotAllocator.clear();
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
		this.mipmapToGenerate.add(index);
		if (this.config.autoMipMap) {
			if (this.config.delayMipMap) {
				clearTimeout(this.timeout);
				this.timeout = setTimeout(() => {
					this.generateMipMap();
				}, this.config.delayMipMap);
			} else {
				this.generateMipMap();
			}
		}
	}

	generateMipMap() {
		const { gl, glTextures } = this;
		if (this.mipmapToGenerate.size) {
			for (let index of this.mipmapToGenerate) {
				const glTexture = glTextures[index];
				gl.bindTexture(gl.TEXTURE_2D, glTexture.texture);
				gl.generateMipmap(gl.TEXTURE_2D);
			}
			this.mipmapToGenerate.clear();
			for (let listener of this.mipmapListeners) {
				listener();
			}
		}
	}

	addMipMapListener(listener) {
		this.mipmapListeners.add(listener);
	}

	async addTexture(imageConfig) {
		const { url, collision_url, texture_url } = imageConfig;
		const [image, textureImage, collisionImage] = await Promise.all([url?.split("?")[0] ,texture_url?.split("?")[0], collision_url?.split("?")[0]].map(u => this.imageLoader.loadImage(u)));

		if (this.urlToTextureIndex[url]) {
			const {index, x, y} = this.urlToTextureIndex[url];
			return this.createAtlas(index, x, y).setImage(imageConfig, image, textureImage, collisionImage);
		}

		const imageWidth = image?.naturalWidth || 0;
		const imageHeight = image?.naturalHeight || 0;
		const { x, y, index } = this.urlToTextureIndex[url] = this.slotAllocator.allocate(imageWidth, imageHeight);
		return this.createAtlas(index, x, y).setImage(imageConfig, image, textureImage, collisionImage);
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
