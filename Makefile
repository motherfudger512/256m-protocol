.PHONY: help install build test clean

help:
	@echo "256M Insurance Protocol - Available Commands"
	@echo ""
	@echo "  make install       - Install dependencies"
	@echo "  make build         - Build program"
	@echo "  make test          - Run all tests"
	@echo "  make deploy        - Deploy to devnet"
	@echo "  make clean         - Clean artifacts"

install:
	yarn install

build:
	anchor build

test:
	chmod +x run-all-tests.sh
	./run-all-tests.sh

deploy:
	chmod +x deploy-devnet.sh
	./deploy-devnet.sh

clean:
	rm -rf target/ node_modules/ *.log test-report.txt
