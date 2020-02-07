const png = /\.png(\?.*)?$/
const jpg = /\.jpe?g(\?.*)?$/
const webp = /\.webp(\?.*)?$/
const svg = /\.svg(\?.*)?$/
function is(types, src) {
  return Array.isArray(types) ? types.some(t => t.test(src)) : types.test(src)
}

const srcProcess = {
  CONVERT_WEBP: 'convertWebp',
  CROP_IMAGE: 'cropImage',
  APPEND_QUERY: 'appendQuery'
}

const pipe = function(fns) {
  return function(item) {
    return fns.reduce(function(prev, fn) {
      if (typeof fn !== 'function') {
        fn = v => v
      }
      return fn(prev)
    }, item)
  }
}

export const providerConfig = {
  alibaba: {
    [srcProcess.CONVERT_WEBP](vm) {
      const {src, isSupportWebp} = vm
      let query = vm.$src || ''
      let previewQuery = vm.$previewSrc || ''

      if (isSupportWebp && is([png, jpg], src)) {
        query += '/format,webp'
        previewQuery += '/format,webp'
      }
      /**
       * 质量变换仅对jpg、webp有效。（png已被转为webp）
       * @see https://help.aliyun.com/document_detail/44705.html?spm=a2c4g.11186623.6.1256.347d69cb9tB4ZR
       */
      if (is([png, jpg, webp], src)) query += '/quality,Q_75'

      vm.$src = query
      vm.$previewSrc = previewQuery
      return vm
    },

    [srcProcess.CROP_IMAGE](vm) {
      const {$src = '', width, height, autocrop, src} = vm

      if (!autocrop || is(svg, src) || !src) return vm
      const DPR = 2
      let dpr = (window && window.devicePixelRatio) || DPR
      if (dpr === 1) {
        dpr = DPR
      }
      const actions = ['/resize']
      const WIDTH = `w_${width * dpr}`
      const HEIGHT = `h_${height * dpr}`
      const AUTOCROP = `m_fill`

      if (isNaN(width) && isNaN(height)) {
        return vm
      }

      if (!isNaN(width) && !isNaN(height)) {
        actions.push(AUTOCROP)
      }

      if (!isNaN(height)) {
        actions.push(HEIGHT)
      }

      if (!isNaN(width)) {
        actions.push(WIDTH)
      }

      const resizeQuery = actions.join(',')

      vm.$src = resizeQuery + $src

      return vm
    },

    [srcProcess.APPEND_QUERY](vm) {
      const {src, extraQuery} = vm
      let query = vm.$src || ''
      let previewQuery = vm.$previewSrc || ''

      const resolveQuery = q => {
        if (q) {
          q =
            src +
            (src.indexOf('?') > -1 ? '&' : '?') +
            'x-oss-process=image' +
            q
        }

        return q
      }

      if (extraQuery) query += '/' + extraQuery

      vm.$src = resolveQuery(query) || src
      vm.$previewSrc = resolveQuery(previewQuery) || src
      return vm
    }
  },
  qiniu: {
    [srcProcess.CONVERT_WEBP](vm) {
      const {src, isSupportWebp} = vm
      let query = vm.$src || ''
      let previewQuery = vm.$previewSrc || ''
      // imageMogr2 接口可支持处理的原图片格式有 psd、jpeg、png、gif、webp、tiff、bmp
      if (is(svg, src)) {
        return vm
      }
      if (isSupportWebp && is([png, jpg], src)) {
        query += '/format/webp'
        previewQuery += '/format/webp'
      }
      query += '/quality/75'

      vm.$src = query
      vm.$previewSrc = previewQuery
      return vm
    },

    [srcProcess.APPEND_QUERY](vm) {
      const {src, extraQuery} = vm
      let query = vm.$src || ''
      let previewQuery = vm.$previewSrc || ''
      if (extraQuery) query += '/' + extraQuery

      const resolveQuery = q => {
        if (q) {
          q = src + (src.indexOf('?') > -1 ? '&' : '?') + 'imageMogr2' + q
        }

        return q
      }

      vm.$src = resolveQuery(query) || src
      vm.$previewSrc = resolveQuery(previewQuery) || src
      return vm
    }
  },
  self: {
    [srcProcess.CONVERT_WEBP](vm) {
      const {src, isSupportWebp} = vm
      if (isSupportWebp && is([png, jpg], src)) {
        vm.$src =
          src.indexOf('?') > -1 ? src.replace('?', '.webp?') : src + '.webp'
      } else {
        vm.$src = src
      }
      return vm
    }
  },
  none: {
    [srcProcess.CONVERT_WEBP](vm) {
      vm.$src = vm.src
      return vm
    }
  }
}

export default vm => {
  vm.$src = ''
  vm.$previewSrc = ''
  const providerPipe = providerConfig[vm.provider]
  const output = pipe([
    providerPipe[srcProcess.CONVERT_WEBP],
    providerPipe[srcProcess.CROP_IMAGE],
    providerPipe[srcProcess.APPEND_QUERY]
  ])(vm)
  return output
}
