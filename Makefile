# ARP: the PM's cockpit. Written by `arpctl init`; repo-owned.
.PHONY: arp arpd
arp: ## ARP TUI (the owner's view)
	@arpctl tui

arpd: ## ARP daemon, foreground
	@arpctl daemon
