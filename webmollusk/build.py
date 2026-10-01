#!/usr/bin/env python3
"""Build with Emscripten 6.0.10, or --native for the macOS reference executable."""
import os
from pathlib import Path
import subprocess
import sys
import tarfile

root = Path(__file__).resolve().parent
os.chdir(root)
web = root.parent / 'docs/webmollusk'
web.mkdir(parents=True, exist_ok=True)
native = '--native' in sys.argv
compiler = os.environ.get('CXX', 'clang++' if native else 'em++')
modules = root / 'vendor/JUCE/modules'
sources = [root/'src/convert.cpp', root/'src/presets.cpp', *sorted((root/'src/dsp').glob('*.cpp'))]
sources += [modules/m/(m + ('.mm' if native and m == 'juce_core' else '.cpp'))
            for m in ('juce_core', 'juce_audio_basics', 'juce_audio_formats', 'juce_dsp')]
sources += [modules/'juce_core/juce_core_CompilationTime.cpp']
flags = ['-std=c++17', '-O2', '-ffp-contract=off', '-I'+str(root/'src'), '-I'+str(modules), '-DNDEBUG',
         '-DJUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1', '-DJUCE_STANDALONE_APPLICATION=1',
         '-DJUCE_USE_CURL=0', '-DJUCE_USE_FLAC=0', '-DJUCE_USE_OGGVORBIS=0',
         '-DJUCE_USE_MP3AUDIOFORMAT=0', '-DJUCE_USE_VDSP_FRAMEWORK=0', '-DJUCE_USE_SIMD=0',
         '-DJUCE_USE_ARM_NEON=0', '-DJUCE_USE_SSE_INTRINSICS=0']
if native:
    (root/'tests/bin').mkdir(exist_ok=True)
    flags += ['-framework', 'Cocoa', '-framework', 'Carbon', '-framework', 'IOKit', '-framework', 'Security',
              '-framework', 'CoreAudio', '-framework', 'AudioToolbox', '-framework', 'Accelerate',
              '-o', str(root/'tests/bin/native')]
else:
    flags += ['--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,worker,node',
              '-sALLOW_MEMORY_GROWTH=1', '-sMAXIMUM_MEMORY=536870912', '-sFILESYSTEM=0',
              '-sEXPORTED_RUNTIME_METHODS=HEAPU8',
              '-sEXPORTED_FUNCTIONS=["_malloc","_free","_mollusk_convert","_mollusk_output_data","_mollusk_output_size","_mollusk_output_rate","_mollusk_output_peak","_mollusk_output_frames"]',
              '-o', str(web/'mollusk.mjs')]
if '--source-only' not in sys.argv:
    subprocess.run([compiler, *(['-x', 'objective-c++'] if native else []), *map(str, sources), *flags], check=True)
if not native:
    with tarfile.open(web/'source.tar.gz', 'w:gz') as archive:
        for path in sorted(root.rglob('*')):
            relative = path.relative_to(root)
            if not path.is_file() or relative.parts[:2] == ('tests', 'bin') or '__pycache__' in relative.parts:
                continue
            archive.add(path, arcname=str(Path('webmollusk-source/webmollusk')/relative))
        for name in ('index.html', 'app.mjs', 'worker.mjs', 'wav.mjs', 'capture.mjs', 'LICENSE', 'NOTICE.txt'):
            archive.add(web/name, arcname='webmollusk-source/docs/webmollusk/'+name)
        archive.add(web.parent/'shared/base.css', arcname='webmollusk-source/docs/shared/base.css')
