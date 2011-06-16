NAME=hypnomessenger
BUILD=$(shell date +%Y.%-m.%-d)

all: clean

	@echo -n "Preparing $(NAME)... "
	@mkdir $(NAME)
	@cp -rp \
	  css \
	  js \
	  img \
	  awesomeness_is_free_of_charge.html \
	  hypno_gui.html \
	  loading.html \
	  close.html \
	  manifest.json \
	  README \
	  $(NAME)
	@sed -i 's_"version": ".*"_"version": "$(BUILD)"_' $(NAME)/manifest.json

	@echo -n "\nCompressing JS... "
	@java -jar .build/compiler.jar --js=$(NAME)/js/hypno_gui.js --js_output_file=$(NAME)/js/_hypno_gui.js
	@java -jar .build/compiler.jar --js=$(NAME)/js/socket.io.js --js_output_file=$(NAME)/js/_socket.io.js
	@java -jar .build/compiler.jar --js=$(NAME)/js/hypno_bg.js  --js_output_file=$(NAME)/js/_hypno_bg.js
	@mv $(NAME)/js/_hypno_gui.js $(NAME)/js/hypno_gui.js
	@mv $(NAME)/js/_socket.io.js $(NAME)/js/socket.io.js
	@mv $(NAME)/js/_hypno_bg.js $(NAME)/js/hypno_bg.js
	@echo -n "done. Compressing CSS... "
	@java -jar .build/yuicompressor.jar --type=css $(NAME)/css/base.css -o $(NAME)/css/_base.css
	@mv $(NAME)/css/_base.css $(NAME)/css/base.css
	@echo "done"
	@echo "Fetching locales from google docs ..."
	@node .build/build_localizations.js $(NAME)

	@cd $(NAME) && zip -qr $(NAME).$(BUILD).zip *
	@mv $(NAME)/$(NAME).$(BUILD).zip .
	@echo ok

	@echo -n "Cleaning... "
	@rm -Rf $(NAME)
	@echo ok
	
clean:
	@rm -Rf $(NAME)