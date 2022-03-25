'use strict';

const { registerFont, createCanvas, loadImage } = require('canvas');

function getWidthAndHeightEl(elCount, elWidth, elHeight) {
	const aspectRatio = elWidth / elHeight;
	let width = aspectRatio > 1 ? Math.round(Math.sqrt(elCount / aspectRatio)) : Math.ceil(Math.sqrt(elCount / aspectRatio));
	if (width == 0) width = 1;
	const height = Math.ceil(elCount / width);
	return {
		width: width,
		height: height,
		elements: elCount
	}
}

function createLayouts(elCount, elWidth, elHeight, triggerSplitCount, maxPagesCount) {
	let preElementsPerPage = elCount / maxPagesCount;
	if (preElementsPerPage < triggerSplitCount) preElementsPerPage = triggerSplitCount;
	let preWH = getWidthAndHeightEl(preElementsPerPage, elWidth, elHeight);
	preElementsPerPage = preWH.width * preWH.height;
	let pagesCount = Math.ceil(elCount / preElementsPerPage);

	let layout = [];
	for (let i = 0; i < pagesCount; ++i) {
		if (i == pagesCount - 1) layout.push(getWidthAndHeightEl(elCount - i * preElementsPerPage, elWidth, elHeight));
		else layout.push(getWidthAndHeightEl(preElementsPerPage, elWidth, elHeight));
	}

	return layout;
}

function createHeader(text, width, height) {
	const canvas = createCanvas(width, height);
	let ctx = canvas.getContext('2d');
	let fontSize = 0.7 * height;
	ctx.textAlign = 'center';
	ctx.fillStyle = '#FFF';
	ctx.font = `${fontSize}px CustomFont`;
	while (ctx.measureText(text).width > 0.8 * width) {
		fontSize -= 2;
		ctx.font = `${fontSize}px CustomFont`;
		if (fontSize <= 4) break;
	}
	ctx.shadowColor = 'black';
	ctx.shadowBlur = fontSize / 12;
	ctx.fillText(text, width / 2, height / 2 + fontSize * 0.35, width * 0.8);
	return canvas;
}

async function loadArray(imgArr) {
	let promiseArr = []
	for (let i = 0; i < imgArr.length; ++i) {
		if (!imgArr[i].hasOwnProperty('_context2d')) promiseArr.push(
			imgArr[i] = loadImage(imgArr[i])
				.catch(err => console.log(`[MERGER] [LOADER] Err: ${err}`)))
	}
	(await Promise.all(promiseArr)).filter(el => el !== undefined);
	return imgArr;
}

class Merger {

	constructor(params = {}) {
		this.defCfg = Object.assign({
			addBackground: false,
			maxPagesCount: 1,
			triggerSplitCount: 1,
			maxOutDimension: 2048,
			headerCoef: 0.1,
			elMargin: 0,
			outerMargin: 0,
			header: null
		}, params);

		; (async () => {
			try {
				if (params.bgPath) this.background = await loadImage(params.bgPath);
			} catch (err) {
				console.log(`[MERGER] Could not load background: ${err.stack}`)
			}
			try {
				if (params.fontPath) registerFont(params.fontPath, { family: 'CustomFont' });
			} catch (err) {
				console.log(`[MERGER] Could not load font: ${err.stack}`)
			}
		})()
	}

	async merge(imgArr, elWidth, elHeight, {
		addBackground = this.defCfg.addBackground,
		maxPagesCount = this.defCfg.maxPagesCount,
		triggerSplitCount = this.defCfg.triggerSplitCount,
		maxOutDimension = this.defCfg.maxOutDimension,
		headerCoef = this.defCfg.headerCoef,
		elMargin = this.defCfg.elMargin,
		outerMargin = this.defCfg.outerMargin,
		header = this.defCfg.header
	} = {}) {

		console.log('[MERGER] Merge process started')

		let canvasArr = await loadArray(imgArr);
		if (!canvasArr.length) throw new Error('[MERGER] No items')

		if (!this.background) addBackground = false;
		elMargin = Math.ceil((elWidth + elHeight) / 2 * elMargin)
		outerMargin = Math.ceil((elWidth + elHeight) / 2 * outerMargin)

		var outImages = []

		const layouts = createLayouts(canvasArr.length, elWidth, elHeight, triggerSplitCount, maxPagesCount);
		let i = 0;
		for (let [index, layout] of layouts.entries()) {

			let preWidth = outerMargin * 2 + layout.width * (elWidth + elMargin * 2);
			let preHeight = outerMargin * 2 + layout.height * (elHeight + elMargin * 2);
			const aspectRatio = preWidth / preHeight;
			let width, height;
			if (aspectRatio >= 1) {
				width = maxOutDimension;
				height = width / aspectRatio;
			}
			else {
				height = maxOutDimension;
				width = height * aspectRatio;
			}
			const mult = width / preWidth;
			const elFinalWidth = mult * elWidth;
			const elFinalHeight = mult * elHeight;
			const currElMargin = mult * elMargin;
			const currOuterMargin = mult * outerMargin;

			let areaMarginTop = currOuterMargin;
			let headerImg;
			if (header) {
				const headerHeight = (width + height) / 2 * headerCoef;
				areaMarginTop += headerHeight
				height += headerHeight;
				const headerText = layouts.length > 1 ? `${header} [${index + 1}/${layouts.length}]` : header;
				headerImg = createHeader(headerText, width, headerHeight);
			}

			const canvas = createCanvas(width, height);
			let ctx = canvas.getContext('2d');
			if (addBackground) ctx.drawImage(this.background, 0, 0,
				this.background.width, this.background.height, 0, 0, canvas.width, canvas.height);
			if (header) ctx.drawImage(headerImg, 0, (currOuterMargin + currElMargin) / 2, headerImg.width, headerImg.height);

			for (let r = 0; r < layout.height; ++r) {
				for (let c = 0; c < layout.width; ++c) {
					if (i >= canvasArr.length) break;
					++i;
					try {
						ctx.drawImage(canvasArr[i - 1], currOuterMargin + c * (elFinalWidth + currElMargin * 2) + currElMargin,
							areaMarginTop + r * (elFinalHeight + currElMargin * 2) + currElMargin, elFinalWidth, elFinalHeight);
					} catch (err) {
						console.log(`[MERGER] Error drawing image. Its place will be empty. ${err.stack}`)
					}
				}
			}
			outImages.push(canvas.toBuffer('image/jpeg', {
				quality: 0.85
			}))
		}

		console.log('[MERGER] Merge process ended')
		return outImages;
	}

}

module.exports = Merger;