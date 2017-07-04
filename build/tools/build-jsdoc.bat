@set REPLACE_FILE=..\Cesium3js.js
@set DOC_PATH=..\Cesium3jsDcos
jsdoc %REPLACE_FILE% -d %DOC_PATH%
@pause