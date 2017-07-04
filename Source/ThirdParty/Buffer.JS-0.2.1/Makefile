sources = base64.js buffer.js
library = buffer.min.js

e1c=head -n `grep -nm 1 -F '*/' $(1) | sed 's/\:.*$$//'` $(1)
cc.list = closure-compiler uglifyjs
cc.uglifyjs = { $(addprefix uglifyjs ,$(addsuffix ;,$(1))) } > $(2)
cc.closure-compiler = { $(call e1c,$(1)); closure-compiler $(addprefix --js ,$(1)) | tr '\n' ' ' | sed 's/\s*$$/\n/'; } > $(2)

compiler ?= $(word 1,$(foreach c,$(cc.list),$(if $(shell which $(c)),$(c))))
ifeq ($(shell which $(compiler)),)
  $(error Unable to find compiler: '$(compiler)'. Try use one of: $(cc.list))
endif
cc = $(call cc.$(compiler),$(1),$(2))

all:
	@echo Actions: compile clean prepare-test test clean-test
	@echo Compiler: $(compiler)

compile: $(library)

$(library): $(sources)
	@$(call cc,$^,$@)

clean:
	@rm -rf $(library)
