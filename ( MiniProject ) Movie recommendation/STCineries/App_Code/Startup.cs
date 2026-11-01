using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(WebSite8.Startup))]
namespace WebSite8
{
    public partial class Startup {
        public void Configuration(IAppBuilder app) {
            ConfigureAuth(app);
        }
    }
}
