import Vue, { VueConstructor, Component, CreateElement } from 'vue'

interface Route {
  path: string;
  name?: string;
  component: Component;
  children?: Route[];
  redirect?: string;
  dynamickey?: string;
}

interface VueRouterOptions {
  mode?: string;
  routes: Route[];
}

interface RoutesMap {
  [key: string]: Route
}

interface pushOptions {
  path: string;
  name?: string;
  params?: string;
  query?: Object;
}

let vue: VueConstructor

export default class VueRouter {
  constructor($options: VueRouterOptions) {
    this.$options = $options
    // 通过创建vue实例来实现路径响应式
    this.app = new Vue({
      data() {
        return {
          current: '/'
        }
      }
    })
  }
  app: Vue
  params: string | undefined
  query: Object | undefined
  $options: VueRouterOptions
  routesMap: RoutesMap = {}
  install(_Vue: VueConstructor) {
    vue = _Vue
    const that = this
    //实现一个混入操作的原因，插件的install阶段非常早，此时并没有Vue实例
    //因此，使用mixin，延迟对应操作到Vue实例构建的过程中来执行。
    vue.mixin({
      beforeCreate() {
        //获取到Router的实例，并将其挂载在原型上
        if ((this.$options as any).router) {
          //根组件beforeCreate时只执行一次
          vue.prototype.$router = (this.$options as any).router
          that.init()
        }
      }
    })
  }
  init() {
    // 绑定事件
    this.bindEvents()
    // 创建routesMap
    this.createRoutesMap()
    // 创建组件
    this.initComponents()
  }
  bindEvents() {
    window.addEventListener('hashchange', this.onHashChange.bind(this))
  }
  onHashChange() {
    this.app.$data.current = window.location.hash.slice(1) || '/'
  }
  createRoutesMap() {
    const { routes } = this.$options
    this.routesMap = deepRoute(routes)
    console.log(this.routesMap)
  }
  initComponents() {
    // 形式：<router-link to="/"> 转换目标=> <a href="#/">xxx</a>
    vue.component('router-link', {
      props: {
        to: String,
      },
      render(h: CreateElement) {
        return h('a', {
          attrs: { href: '#' + this.to }
        }, [this.$slots.default])
      }
    })
    // 获取path对应的Component将它渲染出来
    Vue.component("router-view", {
      render: (h: CreateElement) => {
        //此处的this 能够正确指向 VueRouter内部，是因为箭头函数
        const Component: Component = this.routesMap[this.app.$data.current].component
        return h(Component)
      }
    })
  }
  push (options: string | pushOptions) {
    let go = '/'
    this.app.$data.current = typeof options === 'string'
    ? options
    : (options?.path
      ? options.path
      : (options?.name
        ? getPathByName(this.routesMap, options.name) : '/'))
    if (typeof options === 'string') {
      go = options
    } else {
      const { path, name, params, query } = options
      go = path || getPathByName(this.routesMap, name as any) || has404(this.routesMap) || go
      const route = this.routesMap[go]
      if (params && route.dynamickey) {
        this.params = params
        go = `${go}/${route.dynamickey}=${params}`
      } else if (query) {
        this.query = query
      }
    }
    this.app.$data.current = go
  }
  // replace () {

  // }
}

/**
 * 深度遍历routes
 * @param { Route[] } Route[]
 * @param { string | undefined } prefix
 */
function deepRoute(routes: Route[], prefix = ''): RoutesMap {
  let map: RoutesMap = {}
  routes.map(route => {
    if ((/\/:/g).test(route.path)) {
      route['dynamickey'] = (route.path.match(/:(.*?)/) as any[])[1]
    }
    const key = `${prefix}${route.path}`
    map[key] = route
    if (route.children && route.children?.length > 0) {
      map = {
        ...map,
        ...deepRoute(route.children, key)
      }
    }
  })
  return map
}

/**
 * 通过名字获取对应的组件
 * @param { RoutesMap } map
 * @param { string } name
 */
function getPathByName(map: RoutesMap, name: string) {
  if (Object.keys(map).length <= 0 || !name) return '/'
  let path
  for (const key in map) {
      const element = map[key]
      if (element.name && element.name === name) {
        path = element.path
      }
  }
  return path
}

/**
 * 判断是否有404
 * @param { RoutesMap } map
 */
function has404 (map: RoutesMap): string | undefined {
  return map['404'] ? '404' : undefined
}