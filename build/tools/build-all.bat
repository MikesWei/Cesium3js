node r.js -o main.js
@set TEMP_FILE=temp.temp
@set TEMPLATE_FILE=..\..\Source\Template.js
@set REPLACE_FILE=..\Cesium3js.js
@set REPLACE_MIN_FILE=..\Cesium3js.min.js
@set DOC_PATH=..\Cesium3jsDocs
@copy %TEMPLATE_FILE% %TEMP_FILE%
@sed -i '/\/\/----MeteoLib----/ r %REPLACE_FILE%' %TEMP_FILE%
@copy %TEMP_FILE% %REPLACE_FILE%
@del %TEMP_FILE%
uglifyjs %REPLACE_FILE% -m -o %REPLACE_MIN_FILE%
@pause