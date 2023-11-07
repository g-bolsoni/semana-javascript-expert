export default class VideoProcessor{
    #mp4Demuxer
    #webMWriter
    #buffers = []

    /**
     *
     * @param { object } options
     * @param { import('./mp4Demuxer.js').default} options.mp4Demuxer
     * @param { import('../deps/webm-writer2.js').default} options.webMWriter
     */
    constructor({ mp4Demuxer, webMWriter}){
        this.#mp4Demuxer = mp4Demuxer
        this.#webMWriter = webMWriter
    }

    /** @returns { ReadableStream } */
    mp4Decoder(stream){
        return new ReadableStream({
            start: async (controller) => {
                const decoder = new VideoDecoder({
                    /** @param {VideoFrame} frame */
                    output(frame){
                        controller.enqueue(frame)
                    },
                    error(e){
                        console.error('Error at mp4Decoder', e);
                        controller.error(e)
                    }
                })

                return this.#mp4Demuxer.run(stream, {
                    async onConfig(config){
                        const { supported } = await VideoDecoder.isConfigSupported(config)
                        if(!supported){
                            console.error('MP4 muxer Video decoder config not supported!', config );
                            controller.close()
                            return;
                        }
                        decoder.configure(config)
                    },
                    /** @param {EncodedVideoChunk} chunk */
                    onChunk(chunk){
                        decoder.decode(chunk)
                    }
                })
                // .then(() => {
                //     setTimeout(() => {
                //         controller.close()
                //     }, 1000);
                // })
            },

        })
    }

    encode144p(encoderConfig){
        let _encoder;
        const readable = new ReadableStream({
            start: async (controller) => {
                const { supported } = await VideoEncoder.isConfigSupported(encoderConfig);
                if(!supported){
                    const message = 'Encode144p VideoEncoder config not supported!'
                    console.error(message, encoderConfig);
                    controller.error(message)
                    return;
                }

                _encoder = new VideoEncoder({
                    /**
                     * @param { EncodedVideoChunk } frame
                     * @param { EncodedVideoChunkMetadata } config
                    */
                    output: (frame, config) => {
                        debugger
                        if(config.decoderConfig){
                            const decoderConfig = {
                                type: 'config',
                                config: config.decoderConfig
                            }
                            controller.enqueue(decoderConfig)
                        }
                        controller.enqueue(frame)
                    },
                    error: (err) => {
                        console.error('VideoEncoder 144p ',err);
                        controller.error(err)
                    }
                })
                await _encoder.configure(encoderConfig);
            }
        })

        const writable = new WritableStream({
            async write(frame){
                _encoder.encode(frame)
                frame.close()
            }
        })

        return {
            readable,
            writable
        }
    }

    renderDecodedFramesAndGetEncodedChunks(renderFrame){
        let _decoder;
        return  new TransformStream({
            start: (controller) => {
                _decoder = new VideoDecoder({
                    output(frame){
                        renderFrame(frame)
                    },
                    error(e){
                        console.error('Error at render frames', e);
                        controller.error(e)
                    }
                })
            },
            /**
             *
             * @param {EncodedVideoChunk} encodedChunk
             * @param { TransformStreamDefaultController } controller
             */
            async transform(encodedChunk, controller){
                console.log(encodedChunk)
                if(encodedChunk.type == 'config'){
                    decoder.configure(encodedChunk.config)
                    return;
                }
                _decoder.decode(encodedChunk)
                //Need the encoded version to use WebM
                controller.enqueue(encodedChunk)
            },
            error: () => {}
        })
    }

    transformToWebM(){
        const writable = new WritableStream({
            write(chunk){
                this.#webMWriter.addFrame(chunk)
            },
            close(){
                debugger
            }
        })
        return {
            readable: this.#webMWriter.getStream(),
            writable
        }
    }

    async start({file, encoderConfig, renderFrame, sendMessage}){
        const stream = file.stream()
        const fileName = file.name.split('/').pop().replace('.mp4', '')
        await this.mp4Decoder(stream)
            .pipeThrough(this.encode144p(encoderConfig))
            // .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
            // .pipeThrough(this.transformToWebM())
            // .pipeThrough(
            //     new TransformStream({
            //         transform: ({data, position}, controller) => {
            //             this.#buffers.push(data)
            //             controller.enqueue(data)
            //         },
            //         flush: () => {
            //             // sendMessage({
            //             //     status: 'done',
            //             //     buffers: this.#buffers,
            //             //     fileName: fileName.concat('-144p.webm')
            //             // })
            //             sendMessage({
            //                 status: 'done',
            //             })

            //         }
            //     })
            // )
            .pipeTo(new WritableStream({
                write(frame){
                    // renderFrame(frame)
                }
            }))

    }
}