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
