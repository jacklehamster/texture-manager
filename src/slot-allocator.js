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
