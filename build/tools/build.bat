node r.js -o main.js
@set TEMP_FILE=temp.temp
@set TEMPLATE_FILE=..\..\Source\Template.js
@set REPLACE_FILE=..\Cesium3js.js
@set DOC_PATH=..\Cesium3jsDocs
@copy %TEMPLATE_FILE% %TEMP_FILE%
@sed -i '/\/\/----Cesium3js----/ r %REPLACE_FILE%' %TEMP_FILE%
@copy %TEMP_FILE% %REPLACE_FILE%
@del %TEMP_FILE% 
jsdoc %REPLACE_FILE% -d %DOC_PATH%
@pause