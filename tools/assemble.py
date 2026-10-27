#!/usr/bin/env python3
"""Assemble ui/ into a single HTML page (same result as the exe's assemble()).

Usage: python3 tools/assemble.py [output.html]
Default output: build/openschem.html
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(ROOT, 'ui')

def read(name):
    with open(os.path.join(UI, name), encoding='utf-8') as f:
        return f.read()

def assemble():
    names = [l.strip() for l in read('manifest.txt').splitlines() if l.strip() and not l.strip().startswith('#')]
    js = '\n'.join(read(n) for n in names) + '\n'
    js = js.replace('</script', '<\\/script').replace('<script', '<\\x73cript')
    return read('index.html').replace('/*CSS*/', read('style.css'), 1).replace('/*JS*/', js, 1)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'openschem.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(assemble())
    print(out)
