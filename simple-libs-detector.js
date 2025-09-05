#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const glob = require('glob')

class SimpleLibsDetector {
  constructor() {
    this.libMethods = new Map() // methodName -> [{ class, file, line }]
    this.allFiles = []
  }

  async run() {
    console.log('🔍 Checking unused methods in libs/...\n')

    // Step 1: Find all methods in libs/
    this.findLibMethods()

    // Step 2: Get all TypeScript files for searching
    this.getAllFiles()

    // Step 3: Check each method for usage
    this.checkUsage()
  }

  findLibMethods() {
    const libFiles = glob.sync('libs/**/*.ts', {
      ignore: ['**/*.spec.ts', '**/*.test.ts'],
    })

    for (const file of libFiles) {
      const content = fs.readFileSync(file, 'utf8')
      this.extractMethods(file, content)
    }

    console.log(`Found ${this.libMethods.size} methods in libs/`)
  }

  extractMethods(file, content) {
    const lines = content.split('\n')
    let currentClass = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Find class/interface (but not in comments)
      if (!line.startsWith('//') && !line.includes('//')) {
        const classMatch = line.match(/(?:export\s+)?(?:class|interface)\s+(\w+)/)
        if (classMatch) {
          currentClass = classMatch[1]
          continue
        }
      }

      // Find method
      const methodMatch = line.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/)
      if (methodMatch && currentClass) {
        const methodName = methodMatch[1]

        // Skip constructor and control structures
        if (
          methodName === 'constructor' ||
          methodName === currentClass ||
          ['if', 'for', 'while', 'switch', 'catch', 'else'].includes(methodName)
        ) {
          continue
        }

        if (!this.libMethods.has(methodName)) {
          this.libMethods.set(methodName, [])
        }

        this.libMethods.get(methodName).push({
          className: currentClass,
          file,
          line: i + 1,
          fullSignature: line,
        })
      }
    }
  }

  getAllFiles() {
    this.allFiles = glob.sync('**/*.ts', {
      ignore: ['node_modules/**', 'dist/**', '**/*.spec.ts', '**/*.test.ts'],
    })

    console.log(`Searching ${this.allFiles.length} files for method calls`)
  }

  checkUsage() {
    const unused = []
    let checked = 0

    for (const [methodName, definitions] of this.libMethods) {
      checked++
      if (checked % 50 === 0) {
        process.stdout.write(`\rChecked ${checked}/${this.libMethods.size} methods...`)
      }

      let isUsed = false
      let usedInFiles = []

      // Search for method calls in all files
      let hasExternalUsage = false

      for (const file of this.allFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8')
          const lines = content.split('\n')

          // Determine if this file is in the same module as the method definitions
          const definitionModules = definitions
            .map((def) => {
              const parts = def.file.split('/')
              const libIndex = parts.findIndex((p) => p === 'libs')
              return libIndex >= 0 ? parts[libIndex + 1] : null
            })
            .filter(Boolean)

          const currentFileParts = file.split('/')
          const currentFileLibIndex = currentFileParts.findIndex((p) => p === 'libs')
          const currentFileModule = currentFileLibIndex >= 0 ? currentFileParts[currentFileLibIndex + 1] : null

          const isExternalFile = !definitionModules.includes(currentFileModule)

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()

            // Skip method definitions and interface declarations
            if (line.includes(`${methodName}(`)) {
              // Skip if it's a method definition or interface declaration
              if (
                line.match(/(?:async\s+)?(?:public\s+|private\s+|protected\s+)?(?:static\s+)?\w+\s*\([^)]*\)\s*[:{]/) ||
                line.match(/^\w+\s*\([^)]*\)\s*:\s*/) ||
                line.includes('interface ') ||
                line.includes('class ') ||
                (line.includes('export ') && line.includes('function'))
              ) {
                continue
              }

              // This looks like an actual method call
              isUsed = true
              usedInFiles.push(file)

              if (isExternalFile) {
                hasExternalUsage = true
              }

              break
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      // For interface methods, only consider it "used" if there's external usage
      // However, repository interfaces used by services should be considered used
      const isInterfaceMethod = definitions.some((def) => def.file.includes('/interfaces/'))
      const isRepositoryInterface = definitions.some((def) => def.file.includes('repository.interface'))
      const hasServiceUsage = usedInFiles.some((file) => file.includes('service'))

      if (isInterfaceMethod && !hasExternalUsage) {
        // Repository interfaces used by services should be considered used
        if (isRepositoryInterface && hasServiceUsage) {
          isUsed = true
        } else {
          isUsed = false
        }
      }

      if (!isUsed) {
        unused.push(...definitions)
      }
    }

    console.log(`\n`)

    if (unused.length === 0) {
      console.log('✅ No unused methods found in libs/')
      return
    }

    console.log(`❌ Found ${unused.length} unused methods in libs/:\n`)

    // Check if --exit-code flag is provided
    const hasExitCodeFlag = process.argv.includes('--exit-code')

    // Group by file
    const byFile = new Map()
    for (const method of unused) {
      if (!byFile.has(method.file)) {
        byFile.set(method.file, [])
      }
      byFile.get(method.file).push(method)
    }

    for (const [file, methods] of byFile) {
      console.log(`📁 ${file}:`)
      for (const method of methods) {
        console.log(`  ❌ ${method.className}.${method.fullSignature.split('(')[0].trim()} (line ${method.line})`)
      }
      console.log()
    }

    // Exit with error code if --exit-code flag is provided and there are unused methods
    if (hasExitCodeFlag && unused.length > 0) {
      process.exit(1)
    }
  }
}

if (require.main === module) {
  const detector = new SimpleLibsDetector()
  detector.run().catch(console.error)
}
