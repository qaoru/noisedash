import * as Tone from 'tone'

export default {
  name: 'Noise',

  data: () => ({
    mainPlayLoading: true,
    isTimerValid: false,
    selectedProfile: {},
    profileItems: [],
    profileDialog: false,
    profileName: '',
    isProfileValid: false,
    profileMoreDialog: false,
    importDialog: false,
    isImportValid: false,
    exportDialog: false,
    importedProfile: null,
    importedProfileName: '',
    exportedProfile: {},
    infoSnackbar: false,
    infoSnackbarText: '',
    playDisabled: false,
    isTimerEnabled: false,
    hours: 0,
    minutes: 0,
    seconds: 30,
    duration: 30,
    timeRemaining: 0,
    noiseColor: 'pink',
    noiseColorItems: ['pink', 'white', 'brown'],
    volume: -10,
    isFilterEnabled: false,
    filterCutoff: 1000,
    filterType: 'lowpass',
    filterTypeItems: ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'notch', 'allpass', 'peaking'],
    isLFOFilterCutoffEnabled: false,
    lfoFilterCutoffFrequency: 0.5,
    lfoFilterCutoffMin: 0,
    lfoFilterCutoffMax: 5000,
    lfoFilterCutoffRange: [100, 5000],
    isTremoloEnabled: false,
    tremoloFrequency: 0.5,
    tremoloDepth: 0.5,
    isReverbEnabled: false,
    allSamples: [],
    loadedSamples: [],
    selectedSample: null,
    uploadSampleDialog: false,
    addSampleDialog: false,
    checkedSamples: [],
    sampleName: '',
    isSampleUploadValid: false,
    canUpload: false,
    editSampleDialog: false,
    previewSampleLoopPointsEnabled: false,
    previewSampleLoopStart: 0,
    previewSampleLoopEnd: 0,
    previewSampleFadeIn: 0,
    previewSamplePlaying: false,
    selectedPreviewSample: {},
    previewSampleItems: [],
    isEditSampleValid: false,
    previewSampleButtonText: 'Preview Sample',
    previewSampleLoading: true,
    previewSampleLength: 0,
    errorSnackbar: false,
    errorSnackbarText: '',
    rules: {
      lt (n) {
        return value => (!isNaN(parseInt(value, 10)) && value < n) || 'Must be less than ' + n
      },
      gt (n) {
        return value => (!isNaN(parseInt(value, 10)) && value > n) || 'Must be greater than ' + n
      },
      required () {
        return value => !!value || 'Required'
      }
    }
  }),
  computed: {
    unloadedSamples: function () {
      const samples = []
      this.allSamples.forEach(s1 => {
        const result = this.loadedSamples.find(s2 => s2.id === s1.id)
        if (!result) {
          samples.push(s1)
        }
      })
      return samples
    }
  },
  created () {
    this.noise = new Tone.Noise()
    this.filter = new Tone.Filter()
    this.tremolo = new Tone.Tremolo()
    this.lfo = new Tone.LFO()
    this.players = new Tone.Players()
    this.samplePreviewPlayer = new Tone.Player().toDestination()
    this.samplePreviewPlayer.loop = true

    this.populateProfileItems(0)
    this.populatePreviewSampleItems()
    this.getSamples()
    this.getCurrentUser()
  },
  beforeDestroy () {
    this.stop()
  },
  methods: {
    play () {
      if (!this.players.loaded) {
        return
      }

      this.playDisabled = true
      Tone.Transport.cancel()

      if (!this.isFilterEnabled && !this.isTremoloEnabled) {
        this.noise = new Tone.Noise({ volume: this.volume, type: this.noiseColor }).toDestination()
      } else if (!this.isFilterEnabled && this.isTremoloEnabled) {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.noise = new Tone.Noise({ volume: this.volume, type: this.noiseColor }).connect(this.tremolo)
      } else if (this.isFilterEnabled && !this.isTremoloEnabled) {
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).toDestination()
        this.noise = new Tone.Noise({ volume: this.volume, type: this.noiseColor }).connect(this.filter)
      } else if (this.isFilterEnabled && this.isTremoloEnabled) {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).connect(this.tremolo)
        this.noise = new Tone.Noise({ volume: this.volume, type: this.noiseColor }).connect(this.filter)
      } else {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).connect(this.tremolo)
        this.noise = new Tone.Noise({ volume: this.volume, type: this.noiseColor }).connect(this.filter)
      }

      if (this.isLFOFilterCutoffEnabled) {
        this.lfo = new Tone.LFO({ frequency: this.lfoFilterCutoffFrequency, min: this.lfoFilterCutoffRange[0], max: this.lfoFilterCutoffRange[1] })
        this.lfo.connect(this.filter.frequency).start()
      }

      this.loadedSamples.forEach(s => {
        this.players.player(s.id).loop = true
        this.players.player(s.id).fadeIn = s.fadeIn
        if (s.loopPointsEnabled) {
          this.players.player(s.id).setLoopPoints(s.loopStart, s.loopEnd)
        }
        this.players.player(s.id).volume.value = s.volume
      })

      if (this.isTimerEnabled) {
        this.duration = parseInt((this.hours * 3600)) + parseInt((this.minutes * 60)) + parseInt(this.seconds)
        this.noise.sync().start(0).stop(this.duration)
        Tone.Transport.loopEnd = this.duration
        this.timeRemaining = this.duration
        this.transportInterval = setInterval(() => this.stop(), this.duration * 1000 + 100)
        this.timeRemainingInterval = setInterval(() => this.startTimer(), 1000)

        this.loadedSamples.forEach(s => {
          this.players.player(s.id).unsync().sync().start(0).stop(this.duration)
        })
      } else {
        this.noise.sync().start(0)

        this.loadedSamples.forEach(s => {
          this.players.player(s.id).unsync().sync().start(0)
        })
      }

      Tone.Transport.start()
    },
    stop () {
      clearInterval(this.transportInterval)
      Tone.Transport.stop()
      this.playDisabled = false

      clearInterval(this.timeRemainingInterval)
      this.timeRemaining = 0
      this.duration = 0
    },
    startTimer () {
      this.timeRemaining -= 1
    },
    updateVolume () {
      this.noise.volume.value = this.volume
    },
    updateNoiseColor () {
      this.noise.type = this.noiseColor
    },
    updateFilterType () {
      this.filter.type = this.filterType
    },
    updateFilterCutoff () {
      this.filter.set({ frequency: this.filterCutoff })
    },
    updateLFOFilterCutoffFrequency () {
      this.lfo.set({ frequency: this.lfoFilterCutoffFrequency })
    },
    updateLFOFilterCutoffRange () {
      this.lfo.set({ min: this.lfoFilterCutoffRange[0], max: this.lfoFilterCutoffRange[1] })
    },
    updateTremoloFrequency () {
      this.tremolo.set({ frequency: this.tremoloFrequency })
    },
    updateTremoloDepth () {
      this.tremolo.set({ depth: this.tremoloDepth })
    },
    updateAudioChain () {
      this.noise.disconnect()

      if (!this.isFilterEnabled && !this.isTremoloEnabled) {
        this.noise.toDestination()
      } else if (!this.isFilterEnabled && this.isTremoloEnabled) {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.noise.connect(this.tremolo)
      } else if (this.isFilterEnabled && !this.isLFOFilterCutoffEnabled && !this.isTremoloEnabled) {
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).toDestination()
        this.noise.connect(this.filter)
        this.lfo.disconnect()
        this.lfo.stop()
      } else if (this.isFilterEnabled && this.isLFOFilterCutoffEnabled && !this.isTremoloEnabled) {
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).toDestination()
        this.noise.connect(this.filter)
        this.lfo = new Tone.LFO({ frequency: this.lfoFilterCutoffFrequency, min: this.lfoFilterCutoffRange[0], max: this.lfoFilterCutoffRange[1] })
        this.lfo.connect(this.filter.frequency).start()
      } else if (this.isFilterEnabled && this.isLFOFilterCutoffEnabled && this.isTremoloEnabled) {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).connect(this.tremolo)
        this.noise.connect(this.filter)
        this.lfo = new Tone.LFO({ frequency: this.lfoFilterCutoffFrequency, min: this.lfoFilterCutoffRange[0], max: this.lfoFilterCutoffRange[1] })
        this.lfo.connect(this.filter.frequency).start()
      } else {
        this.tremolo = new Tone.Tremolo({ frequency: this.tremoloFrequency, depth: this.tremoloDepth }).toDestination().start()
        this.filter = new Tone.Filter(this.filterCutoff, this.filterType).connect(this.tremolo)
        this.noise.connect(this.filter)
      }
    },
    populateProfileItems (profileId) {
      this.$http.get('/profiles')
        .then(response => {
          if (response.status === 200) {
            if (response.data.profiles.length === 0) {
              this.addDefaultProfile()
            } else {
              this.profileItems = response.data.profiles
              if (profileId === 0) {
                this.selectedProfile = this.profileItems[0]
              } else {
                this.selectedProfile = this.profileItems.find(p => p.id === profileId)
              }
              this.exportedProfile = this.profileItems[0]
              this.loadProfile()
            }
          }
        })
    },
    addDefaultProfile () {
      this.$http.post('/profiles/default')
        .then(response => {
          if (response.status === 200) {
            const defaultProfile = { id: response.data.id, text: 'Default' }
            this.profileItems = [defaultProfile]
            this.selectedProfile = defaultProfile
          }
        })
    },
    saveProfile () {
      this.$http.post('/profiles', {
        name: this.profileName,
        isTimerEnabled: this.isTimerEnabled,
        duration: this.duration,
        volume: this.volume,
        noiseColor: this.noiseColor,
        isFilterEnabled: this.isFilterEnabled,
        filterType: this.filterType,
        filterCutoff: this.filterCutoff,
        isLFOFilterCutoffEnabled: this.isLFOFilterCutoffEnabled,
        lfoFilterCutoffFrequency: this.lfoFilterCutoffFrequency,
        lfoFilterCutoffLow: this.lfoFilterCutoffRange[0],
        lfoFilterCutoffHigh: this.lfoFilterCutoffRange[1],
        isTremoloEnabled: this.isTremoloEnabled,
        tremoloFrequency: this.tremoloFrequency,
        tremoloDepth: this.tremoloDepth,
        samples: this.loadedSamples
      }).then(response => {
        if (response.status === 200) {
          this.profileDialog = false
          this.populateProfileItems(response.data.id)
          this.infoSnackbarText = 'Profile Saved'
          this.infoSnackbar = true
        }
      })
        .catch(() => {
          this.errorSnackbarText = 'Error Saving Profile'
          this.errorSnackbar = true
        })
    },
    updateProfile () {
      this.$http.put('/profiles/'.concat(this.selectedProfile.id), {
        isTimerEnabled: this.isTimerEnabled,
        duration: this.duration,
        volume: this.volume,
        noiseColor: this.noiseColor,
        isFilterEnabled: this.isFilterEnabled,
        filterType: this.filterType,
        filterCutoff: this.filterCutoff,
        isLFOFilterCutoffEnabled: this.isLFOFilterCutoffEnabled,
        lfoFilterCutoffFrequency: this.lfoFilterCutoffFrequency,
        lfoFilterCutoffLow: this.lfoFilterCutoffRange[0],
        lfoFilterCutoffHigh: this.lfoFilterCutoffRange[1],
        isTremoloEnabled: this.isTremoloEnabled,
        tremoloFrequency: this.tremoloFrequency,
        tremoloDepth: this.tremoloDepth,
        samples: this.loadedSamples
      }).then(response => {
        if (response.status === 200) {
          this.infoSnackbarText = 'Profile Saved'
          this.infoSnackbar = true
        }
      })
        .catch(() => {
          this.errorSnackbarText = 'Error Saving Profile'
          this.errorSnackbar = true
        })
    },
    loadProfile () {
      this.$http.get('/profiles/'.concat(this.selectedProfile.id))
        .then(response => {
          if (response.status === 200) {
            const profile = response.data.profile

            this.isTimerEnabled = profile.isTimerEnabled
            this.duration = profile.duration
            this.volume = profile.volume
            this.noiseColor = profile.noiseColor
            this.isFilterEnabled = profile.isFilterEnabled
            this.filterType = profile.filterType
            this.filterCutoff = profile.filterCutoff
            this.isLFOFilterCutoffEnabled = profile.isLFOFilterCutoffEnabled
            this.lfoFilterCutoffFrequency = profile.lfoFilterCutoffFrequency
            this.lfoFilterCutoffRange[0] = profile.lfoFilterCutoffLow
            this.lfoFilterCutoffRange[1] = profile.lfoFilterCutoffHigh
            this.isTremoloEnabled = profile.isTremoloEnabled
            this.tremoloFrequency = profile.tremoloFrequency
            this.tremoloDepth = profile.tremoloDepth

            this.loadedSamples = profile.samples
          }
        })
        .catch(() => {
          this.errorSnackbarText = 'Error Loading Profile'
          this.errorSnackbar = true
        })
    },
    deleteProfile () {
      this.$http.delete('/profiles/'.concat(this.selectedProfile.id))
        .then(response => {
          if (response.status === 200) {
            this.populateProfileItems(0)
            this.infoSnackbarText = 'Profile Deleted'
            this.infoSnackbar = true
          }
        })
        .catch(() => {
          this.errorSnackbarText = 'Error Deleting Profile'
          this.errorSnackbar = true
        })
    },
    getSamples () {
      this.$http.get('/samples')
        .then(response => {
          if (response.status === 200) {
            this.allSamples = response.data.samples
            this.allSamples.forEach(s => {
              if (!this.players.has(s.id)) {
                this.players.add(s.id, '/samples/' + s.user + '_' + s.name).toDestination()
              }
            })
            this.mainPlayLoading = false
          }
        })
    },
    uploadSample () {
      const formData = new FormData()

      formData.append('name', this.sampleName)
      formData.append('sample', this.selectedSample)

      this.$http.post('/samples', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
        .then(response => {
          if (response.status === 200) {
            this.getSamples()
            this.populatePreviewSampleItems()
            this.infoSnackbarText = 'Sample Uploaded'
            this.infoSnackbar = true
          }
        })
        .catch((error) => {
          if (error.response.status === 409) {
            this.errorSnackbarText = 'Error Uploading Sample: Duplicate Sample Name'
          } else {
            this.errorSnackbarText = 'Error Uploading Sample'
          }
          this.errorSnackbar = true
        })

      this.uploadSampleDialog = false
    },
    addSample () {
      this.checkedSamples.forEach(i => {
        const load = this.allSamples.find(e => e.id === i)
        load.volume = -10
        this.loadedSamples.push(load)
      })

      this.addSampleDialog = false
      this.checkedSamples = []
    },
    updateSampleVolume (id, index) {
      this.players.player(id).volume.value = this.loadedSamples[index].volume
      this.$forceUpdate()
    },
    removeSample (index) {
      this.loadedSamples.splice(index, 1)
    },
    getCurrentUser () {
      this.$http.get('/users/current')
        .then(response => {
          if (response.status === 200) {
            this.canUpload = response.data.user.canUpload
            this.$vuetify.theme.dark = response.data.user.darkMode
          }
        })
    },
    resetProfileForm () {
      if (this.$refs.profileForm) {
        this.$refs.profileForm.reset()
      }
    },
    resetUploadSampleForm () {
      if (this.$refs.uploadSampleForm) {
        this.$refs.uploadSampleForm.reset()
      }
    },
    openImportDialog () {
      this.profileMoreDialog = false
      this.importDialog = true
    },
    openExportDialog () {
      this.profileMoreDialog = false
      this.exportDialog = true
    },
    async importProfile () {
      const fileContents = await this.readFile(this.importedProfile)
      const profileJSON = JSON.parse(fileContents)

      this.$http.post('/profiles/import', {
        name: this.importedProfileName,
        isTimerEnabled: profileJSON.isTimerEnabled,
        duration: profileJSON.duration,
        volume: profileJSON.volume,
        noiseColor: profileJSON.noiseColor,
        isFilterEnabled: profileJSON.isFilterEnabled,
        filterType: profileJSON.filterType,
        filterCutoff: profileJSON.filterCutoff,
        isLFOFilterCutoffEnabled: profileJSON.isLFOFilterCutoffEnabled,
        lfoFilterCutoffFrequency: profileJSON.lfoFilterCutoffFrequency,
        lfoFilterCutoffLow: profileJSON.lfoFilterCutoffLow,
        lfoFilterCutoffHigh: profileJSON.lfoFilterCutoffHigh,
        isTremoloEnabled: profileJSON.isTremoloEnabled,
        tremoloFrequency: profileJSON.tremoloFrequency,
        tremoloDepth: profileJSON.tremoloDepth
      }).then(response => {
        if (response.status === 200) {
          this.importDialog = false
          this.populateProfileItems(response.data.id)
          this.infoSnackbarText = 'Profile Imported and Saved'
          this.infoSnackbar = true
        }
      })
        .catch(() => {
          this.errorSnackbarText = 'Error Saving Profile'
          this.errorSnackbar = true
        })

      if (this.$refs.importForm) {
        this.$refs.importForm.reset()
      }
    },
    readFile (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = res => {
          resolve(res.target.result)
        }
        reader.onerror = err => reject(err)

        reader.readAsText(file)
      })
    },
    exportProfile () {
      this.$http.get('/profiles/'.concat(this.exportedProfile.id))
        .then(response => {
          if (response.status === 200) {
            const profile = response.data.profile

            const profileJSON = {}
            profileJSON.name = this.exportedProfile.text
            profileJSON.isTimerEnabled = profile.isTimerEnabled
            profileJSON.duration = profile.duration
            profileJSON.volume = profile.volume
            profileJSON.noiseColor = profile.noiseColor
            profileJSON.isFilterEnabled = profile.isFilterEnabled
            profileJSON.filterType = profile.filterType
            profileJSON.filterCutoff = profile.filterCutoff
            profileJSON.isLFOFilterCutoffEnabled = profile.isLFOFilterCutoffEnabled
            profileJSON.lfoFilterCutoffFrequency = profile.lfoFilterCutoffFrequency
            profileJSON.lfoFilterCutoffLow = profile.lfoFilterCutoffLow
            profileJSON.lfoFilterCutoffHigh = profile.lfoFilterCutoffHigh
            profileJSON.isTremoloEnabled = profile.isTremoloEnabled
            profileJSON.tremoloFrequency = profile.tremoloFrequency
            profileJSON.tremoloDepth = profile.tremoloDepth

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profileJSON))
            const downloadAnchorNode = document.createElement('a')
            downloadAnchorNode.setAttribute('href', dataStr)
            downloadAnchorNode.setAttribute('download', profileJSON.name + '.json')
            document.body.appendChild(downloadAnchorNode) // required for firefox
            downloadAnchorNode.click()
            downloadAnchorNode.remove()
          }
        })
        .catch(() => {
          this.errorSnackbarText = 'Error Loading Profile'
          this.errorSnackbar = true
        })

      this.exportDialog = false
    },
    populatePreviewSampleItems () {
      this.$http.get('/samples')
        .then(response => {
          if (response.status === 200) {
            this.previewSampleItems = response.data.samples
            if (this.previewSampleItems.length > 0) {
              this.selectedPreviewSample = this.previewSampleItems[0]
            }
          }
        })
    },
    openEditSampleForm () {
      if (this.previewSampleItems.length > 0) {
        this.selectedPreviewSample = this.previewSampleItems[0]
      }
      this.loadPreviewSample()
    },
    closeEditSampleForm () {
      this.editSampleDialog = false
      this.previewSampleLoading = true
      if (this.previewSamplePlaying) {
        this.previewSamplePlaying = false
        this.previewSampleButtonText = 'Preview Sample'
        this.samplePreviewPlayer.stop()
      }
    },
    loadPreviewSample () {
      this.previewSampleLoading = true
      this.$http.get('/samples/'.concat(this.selectedPreviewSample.id))
        .then(async response => {
          if (response.status === 200) {
            const sample = response.data.sample

            await this.samplePreviewPlayer.load('/samples/' + sample.user + '_' + sample.name)

            this.previewSampleFadeIn = sample.fadeIn
            this.previewSampleLoopPointsEnabled = sample.loopPointsEnabled
            if (sample.loopPointsEnabled) {
              this.previewSampleLoopStart = sample.loopStart
              this.previewSampleLoopEnd = sample.loopEnd
              this.samplePreviewPlayer.setLoopPoints(this.previewSampleLoopStart, this.previewSampleLoopEnd)
            } else {
              this.previewSampleLoopStart = 0
              this.previewSampleLoopEnd = 0
            }
            this.samplePreviewPlayer.fadeIn = this.previewSampleFadeIn
            this.previewSampleLength = this.samplePreviewPlayer.buffer.duration
            this.previewSampleLoading = false
          }
        })
    },
    previewSample () {
      if (this.previewSamplePlaying) {
        this.previewSamplePlaying = false
        this.previewSampleButtonText = 'Preview Sample'
        this.samplePreviewPlayer.stop()
      } else {
        this.previewSamplePlaying = true
        this.previewSampleButtonText = 'Stop'
        this.samplePreviewPlayer.start()
      }
    },
    editSample () {
      this.$http.put('/samples/'.concat(this.selectedPreviewSample.id), {
        fadeIn: this.previewSampleFadeIn,
        loopPointsEnabled: this.previewSampleLoopPointsEnabled,
        loopStart: this.previewSampleLoopStart,
        loopEnd: this.previewSampleLoopEnd
      }).then(response => {
        if (response.status === 200) {
          this.getSamples()
          this.loadProfile()
          this.closeEditSampleForm()
          this.infoSnackbarText = 'Sample Saved'
          this.infoSnackbar = true
        }
      })
        .catch(() => {
          this.errorSnackbarText = 'Error Saving Sample'
          this.errorSnackbar = true
        })
    },
    updatePreviewSamplePlayerFadeIn () {
      this.samplePreviewPlayer.fadeIn = this.previewSampleFadeIn
    },
    updatePreviewSamplePlayerLoopPoints () {
      if (this.previewSampleLoopStart >= 0 && this.previewSampleLoopEnd <= this.previewSampleLength) {
        this.samplePreviewPlayer.setLoopPoints(this.previewSampleLoopStart, this.previewSampleLoopEnd)
      }
    }
  }
}
