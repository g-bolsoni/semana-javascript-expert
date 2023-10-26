import { createFile } from '../deps/mp4box.0.5.2.js'
export default class MP4Demuxer{
    #onConfig
    #onChunk
    #file

    /**
     * 
     * @param {ReadableStream} stream 
     * @param {object} options 
     * @param {(config: object) => void} options.onConfig
     * 
     * @returns { Promise<void>}
     */
    async run(stream, { onConfig, onChunk }){
        this.#onConfig = onConfig
        this.#onChunk = onChunk
        this.#file = createFile()

        this.#file.onReady = (args) => {
            debugger
        }

        this.#file.onSamples = (args) => {
            debugger
        }

        this.#file.onError = (error) => 
            console.error('Deu ruim mp4demuxer!', error);
            this.#init(stream)

        return this.#init(stream)
    }

    /**
     * 
     * @param {ReadableStream} stream 
     * 
     * @returns { Promise<void>}
     */

    #init(stream){
        let _offset = 0
        const consumeFile = new WritableStream({
            /** @param {Uint8Array} chunk */
            write: (chunk) => {
                const copy = chunk.buffer
                copy.fileStart = _offset
                this.#file.appendBuffer(copy)

                _offset += chunk.length
            },
            close: () => {
                this.#file.flush();
            }
        })

        return stream.pipeTo(consumeFile)
    }
}