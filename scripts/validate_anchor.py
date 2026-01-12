#!/usr/bin/env python3
import re
import sys

BASE58_ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def b58decode(s: str) -> bytes:
    # simple base58 decoder
    alphabet = BASE58_ALPHABET
    base = 58
    num = 0
    for ch in s.encode():
        try:
            idx = alphabet.index(ch)
        except ValueError:
            raise ValueError(f"Invalid base58 character: {chr(ch)}")
        num = num * base + idx
    # convert num to bytes
    full_bytes = num.to_bytes((num.bit_length() + 7) // 8, "big")
    # account for leading ones
    n_pad = len(s) - len(s.lstrip('1'))
    return b"\x00" * n_pad + full_bytes

def find_quoted_values(text: str):
    return re.findall(r'\b([A-Za-z0-9_\-\.]+)\s*=\s*"([^"]+)"', text)

def main():
    path = "Anchor.toml"
    try:
        with open(path, "r", encoding="utf-8") as f:
            txt = f.read()
    except FileNotFoundError:
        print(f"{path} not found", file=sys.stderr)
        sys.exit(2)

    entries = find_quoted_values(txt)
    failures = []
    for key, val in entries:
        # skip obvious non-base58 values
        if val.startswith("~") or val.startswith("/") or val.startswith("http"):
            continue
        # consider likely base58 if length >= 32 and chars subset
        if len(val) >= 32 and all(c.encode() in BASE58_ALPHABET for c in val):
            try:
                b = b58decode(val)
            except Exception as e:
                failures.append((key, val, f"decode_error: {e}"))
                continue
            if len(b) != 32:
                failures.append((key, val, f"decoded_len={len(b)} (expected 32)"))

    if not failures:
        print("All Base58-like values decoded to 32 bytes (or none found).")
        return

    print("Found Base58-like values that fail size check:")
    for k, v, reason in failures:
        print(f"- key: {k}, value: {v} -> {reason}")
    sys.exit(1)

if __name__ == '__main__':
    main()
