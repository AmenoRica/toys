// SPDX-License-Identifier: AGPL-3.0-or-later
// WAV adapter for Mollusk Voice Changer, copyright (C) 2026 Ito Hyakkei.
#include "dsp/EffectChain.h"
#include "PresetManager.h"
#include <cstring>

namespace {
juce::MemoryBlock result;
double resultRate = 0;
double resultPeak = 0;
int resultFrames = 0;
constexpr int blockSize = 1024;

void apply(EffectChain& c, const PresetManager::PresetData& p)
{
    c.gate.setThresholdDb(p.gateThreshDb);
    c.gate.setAttackMs(p.gateAttackMs);
    c.gate.setReleaseMs(p.gateReleaseMs);
    c.hpf.setCutoffHz(p.hpfCutoffHz);
    c.pitchShifter.setSemitones(p.pitchSemitones);
    c.formantShifter.setSemitones(p.formantSemitones);
    c.lfoFilter.setFilterType(static_cast<LFOFilter::FilterType>(p.lfoType - 1));
    c.lfoFilter.setCutoffHz(p.lfoCutoffHz);
    c.lfoFilter.setResonance(p.lfoResonance);
    c.lfoFilter.setLFORate(p.lfoRateHz);
    c.lfoFilter.setLFODepth(p.lfoDepthOct);
    c.lfoFilter.setDryWet(p.lfoDryWet);
    // Fixed-rate Advanced settings give repeatable native/WASM comparisons.
    c.lfoFilter.setRandomRateEnabled(false);
    c.phaser.setRate(p.phaserRate);
    c.phaser.setDepth(p.phaserDepth);
    c.phaser.setFeedback(p.phaserFeedback);
    c.phaser.setMix(p.phaserDryWet);
    c.bpf.setCentreHz(p.bpfCentreHz);
    c.bpf.setQ(p.bpfQ);
    c.bpf.setDryWet(p.bpfDryWet);
    c.outputGain.setGainDb(p.outputGainDb);
}
}

extern "C" {
// Error codes: 1 invalid WAV, 2 unsupported layout/rate, 3 too large,
// 4 read/non-finite input error, 5 non-finite DSP output/write error.
int mollusk_convert(const unsigned char* bytes, int size, int preset)
{
    result.reset();
    resultRate = resultPeak = 0;
    resultFrames = 0;
    if (!bytes || size < 12 || preset < 0 || preset >= 4
        || std::memcmp(bytes, "RIFF", 4) || std::memcmp(bytes + 8, "WAVE", 4))
        return 1;
    if (size > 64 * 1024 * 1024) return 3;
    juce::WavAudioFormat wav;
    std::unique_ptr<juce::AudioFormatReader> reader(wav.createReaderFor(
        new juce::MemoryInputStream(bytes, static_cast<size_t>(size), false), true));
    if (!reader || reader->lengthInSamples <= 0) return 1;
    if (reader->numChannels < 1 || reader->numChannels > 2
        || !std::isfinite(reader->sampleRate)
        || reader->sampleRate < 44100 || reader->sampleRate > 192000)
        return 2;
    if (reader->lengthInSamples > 12000000) return 3;

    EffectChain chain;
    apply(chain, PresetManager::presets[preset]);
    chain.prepare({ reader->sampleRate, blockSize, 1 });
    juce::AudioBuffer<float> input(static_cast<int>(reader->numChannels), blockSize);
    juce::AudioBuffer<float> mono(1, blockSize);
    // Keep the leading DSP delay; flush 0.5 seconds so the last word isn't cut off.
    const int frames = static_cast<int>(reader->lengthInSamples);
    const int total = frames + static_cast<int>(reader->sampleRate * 0.5);
    std::unique_ptr<juce::OutputStream> stream = std::make_unique<juce::MemoryOutputStream>(result, false);
    auto writer = wav.createWriterFor(stream, juce::AudioFormatWriterOptions{}
        .withSampleRate(reader->sampleRate).withNumChannels(1).withBitsPerSample(32)
        .withSampleFormat(juce::AudioFormatWriterOptions::SampleFormat::floatingPoint));
    if (!writer) return 5;
    double peak = 0;
    for (int position = 0; position < total; position += blockSize)
    {
        const int count = std::min(blockSize, total - position);
        const int available = std::max(0, std::min(count, frames - position));
        mono.setSize(1, count, false, false, true);
        mono.clear();
        if (available > 0)
        {
            input.clear();
            if (!reader->read(&input, 0, available, position, true, true)) return 4;
            for (int i = 0; i < available; ++i)
            {
                float value = input.getSample(0, i);
                if (reader->numChannels == 2)
                    value = 0.5f * value + 0.5f * input.getSample(1, i);
                if (!std::isfinite(value)) return 4;
                mono.setSample(0, i, value);
            }
        }
        chain.process(mono);
        for (int i = 0; i < count; ++i)
        {
            const float value = mono.getSample(0, i);
            if (!std::isfinite(value)) return 5;
            peak = std::max(peak, static_cast<double>(std::abs(value)));
        }
        if (!writer->writeFromAudioSampleBuffer(mono, 0, count)) return 5;
    }
    writer.reset(); // Finalise the RIFF header before exposing the output.
    resultRate = reader->sampleRate;
    resultFrames = total;
    resultPeak = peak;
    return 0;
}
const void* mollusk_output_data() { return resultFrames > 0 ? result.getData() : nullptr; }
int mollusk_output_size() { return resultFrames > 0 ? static_cast<int>(result.getSize()) : 0; }
double mollusk_output_rate() { return resultRate; }
double mollusk_output_peak() { return resultPeak; }
int mollusk_output_frames() { return resultFrames; }
}

#if !defined(__EMSCRIPTEN__)
#include <fstream>
#include <iostream>
int main(int argc, char** argv)
{
    if (argc != 4) { std::cerr << "Usage: native input.wav output.wav preset(0-3)\n"; return 1; }
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) return 1;
    std::vector<unsigned char> data((std::istreambuf_iterator<char>(input)), {});
    const int code = mollusk_convert(data.data(), static_cast<int>(data.size()), std::stoi(argv[3]));
    if (code) { std::cerr << "Conversion error " << code << '\n'; return code; }
    std::ofstream output(argv[2], std::ios::binary);
    output.write(static_cast<const char*>(mollusk_output_data()), mollusk_output_size());
    std::cout << "frames=" << resultFrames << " rate=" << resultRate << " peak=" << resultPeak << '\n';
    return output.good() ? 0 : 1;
}
#endif
