# Gibbs Sampler for motif finding in DNA sequences

# sequences.fasta should contain the DNA sequences in FASTA format.
# Example: 
# >seq1
# AGCTAGCTAGCTAGCTAGCT
# >seq2
# CGATCGATCGATCGATCGAT
# >seq3
# TTAGCTAGCTAGCTAGCTAA

import random
import numpy as np
from collections import defaultdict
from typing import List, Tuple
from scipy.special import logsumexp
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import time

def read_fasta(file_path: str) -> List[str]:
    sequences = []
    with open(file_path, 'r') as file:
        seq = ''
        for line in file:
            line = line.strip()
            if line.startswith('>'):
                if seq:
                    sequences.append(seq)
                    seq = ''
            else:
                seq += line
        if seq:
            sequences.append(seq)
    return sequences

def initialize_motifs(sequences: List[str], k: int) -> List[str]:
    motifs = []
    for seq in sequences:
        start = random.randint(0, len(seq) - k)
        motifs.append(seq[start:start + k])
    return motifs

def build_profile(motifs: List[str], pseudocount: float = 1.0) -> np.ndarray:
    k = len(motifs[0])
    profile = np.zeros((4, k)) + pseudocount  # A, C, G, T
    for motif in motifs:
        for i, nucleotide in enumerate(motif):
            if nucleotide == 'A':
                profile[0][i] += 1
            elif nucleotide == 'C':
                profile[1][i] += 1
            elif nucleotide == 'G':
                profile[2][i] += 1
            elif nucleotide == 'T':
                profile[3][i] += 1
    profile /= profile.sum(axis=0)
    return profile

def score_motifs(motifs: List[str]) -> int:
    score = 0
    k = len(motifs[0])
    for i in range(k):
        counts = defaultdict(int)
        for motif in motifs:
            counts[motif[i]] += 1
        max_count = max(counts.values())
        score += (len(motifs) - max_count)
    return score

def sample_motif(sequence: str, profile: np.ndarray, k: int) -> str:
    n = len(sequence)
    probabilities = []
    for i in range(n - k + 1):
        kmer = sequence[i:i + k]
        prob = 1.0
        for j, nucleotide in enumerate(kmer):
            if nucleotide == 'A':
                prob *= profile[0][j]
            elif nucleotide == 'C':
                prob *= profile[1][j]
            elif nucleotide == 'G':
                prob *= profile[2][j]
            elif nucleotide == 'T':
                prob *= profile[3][j]
        probabilities.append(prob)
    probabilities = np.array(probabilities)
    probabilities /= probabilities.sum()
    chosen_index = np.random.choice(range(n - k + 1), p=probabilities)
    return sequence[chosen_index:chosen_index + k]

def gibbs_sampler(sequences: List[str], k: int, n_iterations: int, n_restarts: int) -> Tuple[List[str], int]:
    best_motifs = None
    best_score = float('inf')
    for _ in range(n_restarts):
        motifs = initialize_motifs(sequences, k)
        for _ in range(n_iterations):
            i = random.randint(0, len(sequences) - 1)
            current_motifs = motifs[:i] + motifs[i+1:]
            profile = build_profile(current_motifs)
            new_motif = sample_motif(sequences[i], profile, k)
            motifs[i] = new_motif
        current_score = score_motifs(motifs)
        if current_score < best_score:
            best_score = current_score
            best_motifs = motifs
    return best_motifs, best_score

def plot_motif_distribution(motifs: List[str], k: int):
    counts = defaultdict(lambda: [0]*k)
    for motif in motifs:
        for i, nucleotide in enumerate(motif):
            counts[nucleotide][i] += 1
    df = pd.DataFrame(counts)
    df.index = range(1, k+1)
    df = df.fillna(0)
    df = df / df.sum(axis=1).values[:, None]

    plt.figure(figsize=(10, 6))
    sns.heatmap(df.T, annot=True, cmap='Blues', cbar_kws={'label': 'Frequency'})
    plt.xlabel('Position in Motif')
    plt.ylabel('Nucleotide')
    plt.title('Motif Nucleotide Distribution')
    plt.show()

if __name__ == "__main__":
    # Example usage
    sequences = read_fasta('sequences.fasta')
    k = 8  # Length of the motif
    n_iterations = 1000
    n_restarts = 20

    start_time = time.time()
    best_motifs, best_score = gibbs_sampler(sequences, k, n_iterations, n_restarts)
    end_time = time.time()

    print(f"Best Motifs: {best_motifs}")
    print(f"Best Score: {best_score}")
    print(f"Time taken: {end_time - start_time:.2f} seconds")

    plot_motif_distribution(best_motifs, k) 





