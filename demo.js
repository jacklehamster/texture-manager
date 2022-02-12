const express 	= require('express');
const serve   	= require('express-static');
const fs 		= require('fs');
const icongen = require('icon-gen');

const PORT = 3000;

const app = express();

app.use(serve(`${__dirname}`));

icongen('icon.png', './', { }).then((results) => {
}).catch((err) => {
	console.error(err)
});

const server = app.listen(PORT, () => {
	console.log('Demo running at %s', PORT);
});
