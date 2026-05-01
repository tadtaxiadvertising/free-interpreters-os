
import os

file_path = r'c:\Users\Arismendy\OneDrive\Escritorio\Free Interpreters\Interpreter Plastform\free-interpreters-os\easypanel\README.md'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def analyze_table(start_idx, end_idx):
    print(f"Analyzing lines {start_idx+1} to {end_idx+1}")
    for i in range(start_idx, end_idx + 1):
        line = lines[i].strip()
        if not line.startswith('|'): continue
        parts = line.split('|')
        # parts[0] is empty, parts[-1] is empty (usually)
        lengths = [len(p) for p in parts[1:-1]]
        print(f"Line {i+1}: {lengths} | {line}")

# Table 2: 30-33
analyze_table(29, 32)
# Table 3: 37-39
analyze_table(36, 38)
