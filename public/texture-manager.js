(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const { FileUtils } = require("dok-file-utils");

class DataReader {
	constructor(fileUtils, dataEndPoint) {
		this.dataEndPoint = dataEndPoint || "data";
		this.fileUtils = fileUtils || new FileUtils();
	}

	async canWrite() {
		try {
			return JSON.parse(await this.fileUtils.load(`${this.dataEndPoint}/can-write.json`));
		} catch(e) {

		}
		return 0;
	}

	async read(path) {
		try {
			return (await this.fileUtils.load(`${this.dataEndPoint}/${path}`)) || {};
		} catch (e) {
			console.warn("Path: " + path + " unavailable.")
		}
		return {};
	}
}

module.exports = {
	DataReader,
};

},{"dok-file-utils":7}],2:[function(require,module,exports){
class DataWriter {
	constructor(dataEndPoint) {
		this.dataEndPoint = dataEndPoint || "data";
	}

	async write(data) {
		const response = await fetch(this.dataEndPoint, {
		    method: 'POST',
		    cache: 'no-cache',
		    headers: {
		      'Content-Type': 'application/json',
		    },
		    body: JSON.stringify(data),
		});	
		return response.text();
	}
}

module.exports = {
	DataWriter,
};

},{}],3:[function(require,module,exports){
const { DataWriter } = require("./base/data-writer");
const { DataReader } = require("./base/data-reader");

class DirectData {
	constructor(parameters) {
		const { fileUtils, dataReader, dataWriter, dataEndPoint, saveAfterMillis, onSave } = parameters || {};
		this.dataStore = {};
		this.pendingSave = new Set();
		this.dataEndPoint = dataEndPoint || "data";
		this.dataWriter = dataWriter || new DataWriter(this.dataEndPoint);
		this.dataReader = dataReader || new DataReader(fileUtils, this.dataEndPoint);
		this.saveAfterMillis = saveAfterMillis || 3000;
		this.onSave = onSave;
	}

	async getData(path) {
		if (!this.dataStore[path]) {
			this.dataStore[path] = {};
			try {
				this.dataStore[path] = await this.dataReader.read(path);
			} catch (e) {
				console.warn("Path: " + path + " unavailable.")
			}
		}
		return this.dataStore[path];
	}

	didChange(path) {
		clearTimeout(this.timeout);
		this.pendingSave.add(path);
		this.timeout = setTimeout(() => this.performSave(), this.saveAfterMillis);
	}

	async performSave() {
		const canWrite = await this.dataReader.canWrite();

		if (!canWrite) {
			return;
		}
		const response = await this.save();
		console.info(`Save performed. response: ${response}`);
		if (this.onSave) {
			this.onSave();
		}
	}

	async save() {
		const body = {};
		for (let path of this.pendingSave) {
			const data = this.dataStore[path];
			body[path] = data;
		}
		return Object.keys(body).length ? this.dataWriter.write(body) : null;
	}
}

module.exports = {
	DirectData,
};

globalThis.DirectData = DirectData;
},{"./base/data-reader":1,"./base/data-writer":2}],4:[function(require,module,exports){
const { DirectData } = require("./direct-data");

module.exports = {
	DirectData,
};

},{"./direct-data":3}],5:[function(require,module,exports){
class FileUtils {
    constructor(XMLHttpRequest) {
        this.XMLHttpRequest = XMLHttpRequest || globalThis.XMLHttpRequest;
        this.fileStock = {};
    }

    async preload(...urls) {
        return Promise.all(urls.map(async url => {
            return await this.load(url);
        }));
    }

    async load(url, responseType) {
        return !url ? Promise.resolve(null) : new Promise((resolve, reject) => {
            if (this.fileStock[url]) {
                const { data, loaded, onLoadListeners } = this.fileStock[url];
                if (!loaded) {
                    onLoadListeners.push(resolve);
                } else {
                    resolve(data);
                }
            } else {
                const req = new this.XMLHttpRequest();
                this.fileStock[url] = {
                    data: null,
                    url,
                    progress: 0,
                    onLoadListeners: [],
                };
                req.open('GET', url);
                req.responseType = responseType || (url.match(/.(json)$/i) ? "json" : 'blob');

                req.addEventListener('load', e => {
                    if (req.status === 200) {
                        const data = req.response;
                        this.fileStock[url].progress = 1;
                        this.fileStock[url].loaded = true;
                        this.fileStock[url].data = data;
                        this.fileStock[url].onLoadListeners.forEach(callback => callback(data));
                        delete this.fileStock[url].onLoadListeners;
                        resolve(data);
                    }
                    else {
                        reject(new Error(`Url could not load: ${url}`));
                    }
                });
                req.addEventListener('error', e => {
                    reject(new Error("Network Error"));
                });
                req.addEventListener('progress', e => {
                    this.fileStock[url].progress = e.loaded / e.total;
                });
                req.send();
            }
        });
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        FileUtils,
    };
}

},{}],6:[function(require,module,exports){
class ImageLoader {
	constructor(preserve, XMLHttpRequest, Image) {
		this.preserve = preserve || {};
		this.XMLHttpRequest = XMLHttpRequest || globalThis.XMLHttpRequest;
		this.Image = Image || globalThis.Image;
		this.imageStock = {};
	}

	async getBlobUrl(url) {
		await this.loadImage(url);
		return this.preserve[url] ? this.imageStock[url]?.img.src : null; 
	}

	async preloadImages(...urls) {
		return Promise.all(urls.map(async url => {
			return await this.loadImage(url);
		}));
	}

	async loadImage(url) {
		return !url ? Promise.resolve(null) : new Promise((resolve, reject) => {
			if (this.imageStock[url]) {
				const { img, loaded, onLoadListeners } = this.imageStock[url];
				if (!loaded) {
					onLoadListeners.push(resolve);
				} else {
					resolve(img);
				}
			} else {
			    const req = new this.XMLHttpRequest();
			    const img = new this.Image();
			    this.imageStock[url] = {
			    	img,
			    	url,
			    	progress: 0,
			    	onLoadListeners: [],
			    };
			    req.open('GET', url);
		        req.responseType = 'blob';

			    req.addEventListener('load', e => {
			    	if (req.status === 200) {
						if (url.match(/.(jpg|jpeg|png|gif)$/i)) {
							const imageURL = URL.createObjectURL(req.response);
							const { img } = this.imageStock[url];
							img.addEventListener("load", () => {
								if (!this.preserve[url]) {
									URL.revokeObjectURL(imageURL);
								}
								this.imageStock[url].progress = 1;
								this.imageStock[url].loaded = true;
								const listeners = this.imageStock[url].onLoadListeners;
								delete this.imageStock[url].onLoadListeners;
								resolve(img);
								listeners.forEach(callback => callback(img));
							});
							img.src = imageURL;
						} else {
							reject(new Error("Invalid image."));
						}
					}
					else {
						reject(new Error(`Url could not load: ${url}`));
					}
			    });
			    req.addEventListener('error', e => {
			    	reject(new Error("Network Error"));
			    });
			    req.addEventListener('progress', e => {
			    	this.imageStock[url].progress = e.loaded / e.total;
			    });
				req.send();
			}
		});
	}
}

if (typeof module !== "undefined") {
	module.exports = {
    	ImageLoader,
	};
}

},{}],7:[function(require,module,exports){
const { FileUtils } = require("./file-utils");
const { ImageLoader } = require("./image-loader");

module.exports = {
    FileUtils,
    ImageLoader,
};

},{"./file-utils":5,"./image-loader":6}],8:[function(require,module,exports){
const { TextureManager } = require("./texture-manager");
const { TextureUtils } = require("./texture-utils");
const { SlotAllocator } = require("./slot-allocator");


module.exports = {
	TextureManager,
	TextureUtils,
	SlotAllocator,
};

},{"./slot-allocator":9,"./texture-manager":13,"./texture-utils":14}],9:[function(require,module,exports){
const { Slot } = require('./slot');

class SlotAllocator {
	constructor(count, textureSize) {
		this.slots = new Set();
		this.count = count;
		this.textureSize = textureSize;
		this.clear();
	}

	clear() {
		this.slots.clear();
		for (let index = 0; index < this.count; index++) {
			this.add(new Slot(0, 0, this.textureSize, this.textureSize, index));
		}
	}

	findBestFitSlot(width, height) {
		let smallestSlot = null;
		for (let slot of this.slots) {
			if (slot.doesFit(width, height)) {
				const slotSize = slot.size();
				const smallestSlotSize = smallestSlot?.size();
				if (!smallestSlot || slotSize < smallestSlotSize
						|| slotSize === smallestSlotSize && slot.index < smallestSlot.index) {
					smallestSlot = slot;
				}
			}
		}
		return smallestSlot;
	}

	add(slot) {
		this.slots.add(slot);
		slot.allocator = this;
	}

	remove(slot) {
		this.slots.delete(slot);
		slot.allocator = null;
	}

	allocate(width, height) {
		const slot = this.findBestFitSlot(width, height);
		return slot.allocate(width, height);
	}
}

module.exports = {
  SlotAllocator,
};

},{"./slot":10}],10:[function(require,module,exports){
class Slot {
	constructor(x, y, width, height, index) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.index = index;
		this.blockingSlots = new Set();
	}

	crossBlock(slot) {
		if (!slot.isValid() || !this.isValid()) {
			return;
		}
		this.blockingSlots.add(slot);
		slot.blockingSlots.add(this);
	}

	doesFit(width, height) {
		return width <= this.width && height <= this.height;
	}

	size() {
		return this.width * this.height;
	}

	isValid() {
		return this.width > 0  && this.height > 0;
	}

	occupy() {
		for (let slot of this.blockingSlots) {
			this.allocator.remove(slot);
		}
		this.allocator.remove(this);
	}

	allocate(width, height) {
		const bigRightSlot = new Slot(this.x + width, this.y, this.width - width, this.height, this.index);
		if (bigRightSlot.isValid()) {
			this.allocator.add(bigRightSlot);
		}
		const smallBottomSlot = new Slot(this.x, this.y + height, width, this.height - height, this.index);
		if (smallBottomSlot.isValid()) {
			this.allocator.add(smallBottomSlot);
		}
		const smallRightSlot = new Slot(this.x + width, this.y, this.width - width, height, this.index);
		if (smallRightSlot.isValid()) {
			this.allocator.add(smallRightSlot);
		}
		const bigBottomSlot = new Slot(this.x, this.y + height, this.width, this.height - height, this.index);
		if (bigBottomSlot.isValid()) {
			this.allocator.add(bigBottomSlot);
		}
		const cornerSlot = new Slot(this.x + width, this.y + height, this.width - width, this.height - height, this.index);
		if (cornerSlot.isValid()) {
			this.allocator.add(cornerSlot);
		}

		bigRightSlot.crossBlock(bigBottomSlot);
		bigRightSlot.crossBlock(smallRightSlot);
		bigBottomSlot.crossBlock(smallBottomSlot);
		bigRightSlot.crossBlock(cornerSlot);
		bigBottomSlot.crossBlock(cornerSlot);

		this.occupy(this.x,this.y,width,height);

		return {
			x: this.x,
			y: this.y,
			index: this.index,
		};
	}
}


module.exports = {
  Slot,
};

},{}],11:[function(require,module,exports){
const MAX_FRAME_COUNT = Number.MAX_SAFE_INTEGER;

class TextureAtlas {
	constructor(textureManager, index, xOffset, yOffset) {
		this.textureManager = textureManager;
		this.index = index || 0;
		this.maxTextureIndex = 0;
		this.x = xOffset || 0;
		this.y = yOffset || 0;
		this.spriteWidth = 0;
		this.spriteHeight = 0;
		this.startIndex = 0;
		this.endIndex = 0;
		this.hotspot = [0, 0];

		this.tempMatrix = textureManager.tempMatrix;
		this.shortVec4 = textureManager.shortVec4;
		this.floatVec4 = textureManager.floatVec4;
	}

	setFullTexture() {
		this.x = 0;
		this.y = 0;
		this.frameRate = 1;
		this.frameRateMultiplier = 1;
		this.cols = 1;
		this.rows = 1;
		this.spriteWidth = this.textureManager.textureSize - 1;
		this.spriteHeight = this.textureManager.textureSize - 1;
		this.startFrame = 0;
		this.endFrame = 0;
		this.maxFrameCount = MAX_FRAME_COUNT;
		this.firstFrame = 0;
		this.direction = 1;
		this.vdirection = 1;
		return this;
	}

	getSpriteImageForFrame(image, frame) {
		if (this.cols === 1 && this.rows === 1) {
			return image;
		}
		const { spriteWidth, spriteHeight } = this;
		const col = frame % this.cols;
		const row = Math.floor(frame / this.cols);
		const canvas = this.textureManager.canvas;
		canvas.width = spriteWidth;
		canvas.height = spriteHeight;

		const context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.drawImage(image, col * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);
		return canvas;
	}

	setImage(animationData, image, textureImage, collisionImage) {
		const { id, url, collision_url, collision_padding, texture_url, texture_alpha, texture_blend, hotspot } = animationData;
		this.id = id;
		this.onUpdateImage(image, animationData);

		const { x, y, spriteWidth, spriteHeight, index } = this;

		for (let frame = this.startFrame; frame <= this.endFrame; frame++) {
			const spriteImage = this.getSpriteImageForFrame(image, frame);
			const blendedImage = texture_url ? this.textureManager.textureMix(spriteImage, textureImage, texture_alpha, texture_blend) : spriteImage;
			if (!blendedImage) {
				continue;
			}

			const col = frame % this.cols;
			const row = Math.floor(frame / this.cols);
			this.textureManager.saveTexture(index, x + col * spriteWidth, y + row * spriteHeight, blendedImage);
		}

		if (collision_url) {
			this.collisionBoxes = this.textureManager.textureEdgeCalculator.calculateCollisionBoxes(collision_url, this.cols, this.rows, collisionImage);
		} else {
			this.collisionBoxes = null;
		}

		this.collisionPadding = collision_padding;
		this.hotspot = hotspot || [0, 0];


		return this;
	}

	getCollisionBoxNormalized(frame) {
		return this.collisionBoxes ? this.collisionBoxes[frame] : null;
	}

	onUpdateImage(image, animationData) {
		const spriteSheetWidth = image?.naturalWidth || 0;
		const spriteSheetHeight = image?.naturalHeight || 0;
		const { cols, rows, spriteWidth, spriteHeight, frameRate, maxFrameCount, loop, range, firstFrame, direction, vdirection } = animationData;
		const reverse = range && range[1] < range[0];
		this.frameRate = Math.abs(frameRate || 1);
		this.frameRateMultiplier = reverse ? -1 : 1;
		this.cols = cols || (spriteWidth ? Math.ceil(spriteSheetWidth / spriteWidth) : 1);
		this.rows = rows || (spriteHeight ? Math.ceil(spriteSheetHeight / spriteHeight) : 1);
		this.spriteWidth = spriteWidth || spriteSheetWidth / this.cols;
		this.spriteHeight = spriteHeight || spriteSheetHeight / this.rows;
		this.startFrame = (range ? (reverse ? range[1] : range[0]) : 0) || 0;
		this.endFrame = (range ? (reverse ? range[0] : range[1]) : 0) || this.startFrame;
		this.maxFrameCount = maxFrameCount || (loop ? loop * (this.endFrame - this.startFrame) : MAX_FRAME_COUNT);
		this.firstFrame = Math.max(this.startFrame, Math.min(this.endFrame, firstFrame || this.startFrame));
		this.direction = direction || 1;
		this.vdirection = vdirection || 1;
	}

	get spriteSheetWidth() {
		return this.spriteWidth * this.cols;
	}

	get spriteSheetHeight() {
		return this.spriteHeight * this.rows;
	}

	getTextureCoordinatesFromRect(x, y, width, height, direction, vdirection) {
		let x0 = x;
		let x1 = x + width;
		if (direction * this.direction < 0) {
			x0 = x + width;
			x1 = x;
		}

		let y0 = y;
		let y1 = y + height;
		if (vdirection * this.vdirection < 0) {
			y0 = y + height;
			y1 = y;
		}

		const tempMatrix = this.tempMatrix;
		tempMatrix[0] = x0; tempMatrix[1] = y1;
		tempMatrix[4] = x1; tempMatrix[5] = y1;
		tempMatrix[8] = x0; tempMatrix[9] = y0;
		tempMatrix[12] = x1; tempMatrix[13] = y0;
		return this.tempMatrix;
	}

	getTextureCoordinates(direction, vdirection) {
		const { x, y, spriteWidth, spriteHeight } = this;
		return this.getTextureCoordinatesFromRect(x, y, spriteWidth, spriteHeight, direction, vdirection);
	}

	getSpritesheetInfo() {
		const shortVec4 = this.shortVec4;
		shortVec4[0] = this.cols;
		shortVec4[1] = this.rows;
		shortVec4[2] = this.hotspot[0] * 1000.;
		shortVec4[3] = this.hotspot[1] * 1000.;
		return shortVec4;
	}

	getAnimationInfo(options) {
		const floatVec4 = this.floatVec4;
		floatVec4[0] = options?.fixedFrame ?? this.startFrame;
		floatVec4[1] = options?.fixedFrame ?? this.endFrame;
		floatVec4[2] = this.frameRate * this.frameRateMultiplier;
		floatVec4[3] = this.maxFrameCount;
		return floatVec4;
	}
}


module.exports = {
	TextureAtlas,
};

},{}],12:[function(require,module,exports){
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

},{"direct-data":4}],13:[function(require,module,exports){
const { TextureAtlas } = require("./texture-atlas");
const { TextureEdgeCalculator } = require("./texture-edge-calculator");
const { SlotAllocator } = require('./slot-allocator');
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
		gl.generateMipmap(gl.TEXTURE_2D);
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

},{"./slot-allocator":9,"./texture-atlas":11,"./texture-edge-calculator":12,"dok-file-utils":7}],14:[function(require,module,exports){
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

},{}]},{},[8]);
