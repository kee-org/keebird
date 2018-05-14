

PREFIX	:= /usr
DATADIR	:= $(PREFIX)/share

# UUID below is for Thunderbird
TB_EXT_DIR := $(DATADIR)/mozilla/extensions/{3550f703-e582-4d05-9a08-453d09bdfdc6}

all: keebird@kee-org.xpi

keebird@kee-org.xpi: $(shell find xul-ext)
	cd xul-ext && zip --exclude /.tx* -r $(CURDIR)/$@ .

clean:
	rm -f $(CURDIR)/*.xpi

install: all
	install -d $(DESTDIR)$(TB_EXT_DIR)
	install --mode=644 *.xpi $(DESTDIR)$(TB_EXT_DIR)
