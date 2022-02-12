class RowAllocator {
	constructor(count, textureSize) {
		this.textureFills = new Array(count);
		this.nextTextureIndex = 0;
		this.textureSize = textureSize;
		this.clear();		
	}

	clear() {
		this.textureFills.fill(0);
	}

	allocate(width, height) {
		const fitInCurrentTexture = this.textureFills[this.nextTextureIndex] + height <= this.textureSize;

		const index = fitInCurrentTexture ? this.nextTextureIndex : ++this.nextTextureIndex;
		const y = this.textureFills[this.nextTextureIndex];
		this.textureFills[this.nextTextureIndex] += height;
		return { x: 0, y, index };
	}
}

module.exports = {
  RowAllocator,
};
